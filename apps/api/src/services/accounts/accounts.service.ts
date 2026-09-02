import { randomUUID } from "crypto";
import { db, Prisma } from "@webcampus/db";
import type {
  AccountsStudentSearchQuery,
  AddAccountsPaymentInput,
  UpsertAccountsInput,
} from "@webcampus/schemas/accounts";

export type AccountsGroup = "trustee" | "accounts";

const studentInclude = {
  user: { select: { name: true, email: true } },
  department: { select: { name: true, abbreviation: true } },
  admission: true,
} satisfies Prisma.StudentInclude;

type AccountsStudent = Prisma.StudentGetPayload<{
  include: typeof studentInclude;
}>;
type AccountsRecord = {
  id: string;
  studentId: string;
  academicYear: string;
  finalFee: number;
  createdAt: Date;
  updatedAt: Date;
};
type AccountsPayment = {
  id: string;
  accountsId: string;
  amount: number;
  paidAt: Date;
  reference: string | null;
  remarks: string | null;
  createdAt: Date;
};

async function loadAccounts(studentId: string, academicYear?: string) {
  const records = await db.$queryRaw<AccountsRecord[]>(Prisma.sql`
    SELECT * FROM "Accounts" WHERE "studentId" = ${studentId}
    ${academicYear ? Prisma.sql`AND "academicYear" = ${academicYear}` : Prisma.empty}
    ORDER BY "updatedAt" DESC LIMIT 1
  `);
  const accounts = records[0] ?? null;
  if (!accounts) return null;
  const payments = await db.$queryRaw<AccountsPayment[]>(Prisma.sql`
    SELECT * FROM "AccountsPayment" WHERE "accountsId" = ${accounts.id} ORDER BY "paidAt" DESC
  `);
  return { ...accounts, payments };
}

function toStudentDetails(
  student: AccountsStudent,
  accounts: Awaited<ReturnType<typeof loadAccounts>>
) {
  const admission = student.admission;
  const amountPaid =
    accounts?.payments.reduce((total, payment) => total + payment.amount, 0) ??
    0;
  const actualDemand = accounts?.finalFee ?? 0;
  const remainingBalance = Math.max(actualDemand - amountPaid, 0);

  return {
    id: student.id,
    name: student.user.name,
    usn: student.usn,
    applicationNumber: admission?.applicationId ?? null,
    quota: admission?.quota ?? null,
    dob: admission?.dob ?? null,
    claimedCategory: admission?.categoryClaimed ?? null,
    allottedCategory: admission?.categoryAllotted ?? null,
    course: student.department.abbreviation || student.department.name,
    currentSemester: student.currentSemester,
    studentPhone:
      admission?.primaryPhoneNumber ?? admission?.secondaryPhoneNumber ?? null,
    studentEmail: student.user.email ?? admission?.primaryEmail ?? null,
    fatherPhone: admission?.fatherNumber ?? null,
    temporaryUsn: admission?.tempUsn ?? null,
    previousBranch:
      admission?.diplomaBranch ?? admission?.class12thBranch ?? null,
    previousQuota: null,
    accounts: accounts
      ? {
          id: accounts.id,
          academicYear: accounts.academicYear,
          actualDemand,
          amountPaid,
          remainingBalance,
          paymentStatus:
            remainingBalance === 0 && actualDemand > 0
              ? "PAID"
              : amountPaid > 0
                ? "PARTIALLY_PAID"
                : "UNPAID",
          payments: accounts.payments,
        }
      : null,
  };
}

export class AccountsService {
  static async searchStudents(query: AccountsStudentSearchQuery) {
    const groupWhere: Prisma.StudentWhereInput =
      query.group === "trustee"
        ? { admission: { is: { quota: "MANAGEMENT" } } }
        : query.group === "accounts"
          ? { admission: { is: { quota: { not: "MANAGEMENT" } } } }
          : {};

    const students = await db.student.findMany({
      where: {
        AND: [
          groupWhere,
          {
            OR: [
              { usn: { contains: query.query, mode: "insensitive" } },
              {
                user: {
                  is: { name: { contains: query.query, mode: "insensitive" } },
                },
              },
              {
                admission: {
                  is: {
                    applicationId: {
                      contains: query.query,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          },
        ],
      },
      include: studentInclude,
      orderBy: { usn: "asc" },
      take: 20,
    });

    // Batch-load accounts to avoid N+1 queries
    const studentIds = students.map((s) => s.id);
    const accountsRecords =
      studentIds.length > 0
        ? await db.$queryRaw<AccountsRecord[]>`
            SELECT * FROM "Accounts"
            WHERE "studentId" = ANY(${studentIds})
            AND "id" IN (
              SELECT DISTINCT ON ("studentId") "id"
              FROM "Accounts"
              WHERE "studentId" = ANY(${studentIds})
              ORDER BY "studentId", "updatedAt" DESC
            )
          `
        : [];

    const accountsIds = accountsRecords.map((a) => a.id);
    const allPayments =
      accountsIds.length > 0
        ? await db.$queryRaw<AccountsPayment[]>`
            SELECT * FROM "AccountsPayment"
            WHERE "accountsId" = ANY(${accountsIds})
            ORDER BY "paidAt" DESC
          `
        : [];

    // Build lookup maps
    const accountsMap = new Map(accountsRecords.map((a) => [a.studentId, a]));
    const paymentsByAccountsId = new Map<string, AccountsPayment[]>();
    for (const payment of allPayments) {
      const list = paymentsByAccountsId.get(payment.accountsId) ?? [];
      list.push(payment);
      paymentsByAccountsId.set(payment.accountsId, list);
    }

    const details = students.map((student) => {
      const accounts = accountsMap.get(student.id) ?? null;
      const accountsWithPayments = accounts
        ? {
            ...accounts,
            payments: paymentsByAccountsId.get(accounts.id) ?? [],
          }
        : null;
      return toStudentDetails(student, accountsWithPayments);
    });

    return {
      status: "success" as const,
      message: "Students fetched successfully",
      data: details,
    };
  }

  static async getStudent(studentId: string, academicYear?: string) {
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: studentInclude,
    });
    if (!student) throw new Error("Student not found");
    return {
      status: "success" as const,
      message: "Student details fetched successfully",
      data: toStudentDetails(
        student,
        await loadAccounts(student.id, academicYear)
      ),
    };
  }

  static async saveFee(studentId: string, input: UpsertAccountsInput) {
    await this.ensureStudent(studentId);
    const id = randomUUID();
    const now = new Date();
    const records = await db.$queryRaw<AccountsRecord[]>(Prisma.sql`
      INSERT INTO "Accounts" ("id", "studentId", "academicYear", "finalFee", "createdAt", "updatedAt")
      VALUES (${id}, ${studentId}, ${input.academicYear}, ${input.finalFee}, ${now}, ${now})
      ON CONFLICT ("studentId", "academicYear") DO UPDATE
      SET "finalFee" = EXCLUDED."finalFee", "updatedAt" = EXCLUDED."updatedAt"
      RETURNING *
    `);
    const accounts = records[0];
    return {
      status: "success" as const,
      message: "Fee details saved successfully",
      data: accounts,
    };
  }

  static async addPayment(accountsId: string, input: AddAccountsPaymentInput) {
    const records = await db.$queryRaw<AccountsRecord[]>(
      Prisma.sql`SELECT * FROM "Accounts" WHERE "id" = ${accountsId} LIMIT 1`
    );
    const accounts = records[0];
    if (!accounts) throw new Error("Accounts record not found");
    const paymentId = randomUUID();
    const paidAt = input.paidAt ?? new Date();
    const payments = await db.$queryRaw<AccountsPayment[]>(Prisma.sql`
      INSERT INTO "AccountsPayment" ("id", "accountsId", "amount", "paidAt", "reference", "remarks", "createdAt")
      VALUES (${paymentId}, ${accountsId}, ${input.amount}, ${paidAt}, ${input.reference || null}, ${input.remarks || null}, ${new Date()})
      RETURNING *
    `);
    const payment = payments[0];
    return {
      status: "success" as const,
      message: "Payment recorded successfully",
      data: payment,
    };
  }

  private static async ensureStudent(studentId: string): Promise<void> {
    const exists = await db.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });
    if (!exists) throw new Error("Student not found");
  }
}
