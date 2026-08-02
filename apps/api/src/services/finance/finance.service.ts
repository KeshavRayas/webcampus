import { randomUUID } from "crypto";
import { db, Prisma } from "@webcampus/db";
import type {
  AddFinancePaymentInput,
  FinanceStudentSearchQuery,
  UpsertFinanceInput,
} from "@webcampus/schemas/finance";

export type FinanceGroup = "trustee" | "accounts";

const studentInclude = {
  user: { select: { name: true, email: true } },
  department: { select: { name: true, abbreviation: true } },
  admission: true,
} satisfies Prisma.StudentInclude;

type FinanceStudent = Prisma.StudentGetPayload<{
  include: typeof studentInclude;
}>;
type FinanceRecord = {
  id: string;
  studentId: string;
  academicYear: string;
  finalFee: number;
  createdAt: Date;
  updatedAt: Date;
};
type FinancePayment = {
  id: string;
  financeId: string;
  amount: number;
  paidAt: Date;
  reference: string | null;
  remarks: string | null;
  createdAt: Date;
};

async function loadFinance(studentId: string, academicYear?: string) {
  const records = await db.$queryRaw<FinanceRecord[]>(Prisma.sql`
    SELECT * FROM "Finance" WHERE "studentId" = ${studentId}
    ${academicYear ? Prisma.sql`AND "academicYear" = ${academicYear}` : Prisma.empty}
    ORDER BY "updatedAt" DESC LIMIT 1
  `);
  const finance = records[0] ?? null;
  if (!finance) return null;
  const payments = await db.$queryRaw<FinancePayment[]>(Prisma.sql`
    SELECT * FROM "FinancePayment" WHERE "financeId" = ${finance.id} ORDER BY "paidAt" DESC
  `);
  return { ...finance, payments };
}

function toStudentDetails(
  student: FinanceStudent,
  finance: Awaited<ReturnType<typeof loadFinance>>
) {
  const admission = student.admission;
  const amountPaid =
    finance?.payments.reduce((total, payment) => total + payment.amount, 0) ??
    0;
  const actualDemand = finance?.finalFee ?? 0;
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
    finance: finance
      ? {
          id: finance.id,
          academicYear: finance.academicYear,
          actualDemand,
          amountPaid,
          remainingBalance,
          paymentStatus:
            remainingBalance === 0 && actualDemand > 0
              ? "PAID"
              : amountPaid > 0
                ? "PARTIALLY_PAID"
                : "UNPAID",
          payments: finance.payments,
        }
      : null,
  };
}

export class FinanceService {
  static async searchStudents(query: FinanceStudentSearchQuery) {
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

    const details = await Promise.all(
      students.map(async (student) =>
        toStudentDetails(student, await loadFinance(student.id))
      )
    );
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
        await loadFinance(student.id, academicYear)
      ),
    };
  }

  static async saveFee(studentId: string, input: UpsertFinanceInput) {
    await this.ensureStudent(studentId);
    const id = randomUUID();
    const now = new Date();
    const records = await db.$queryRaw<FinanceRecord[]>(Prisma.sql`
      INSERT INTO "Finance" ("id", "studentId", "academicYear", "finalFee", "createdAt", "updatedAt")
      VALUES (${id}, ${studentId}, ${input.academicYear}, ${input.finalFee}, ${now}, ${now})
      ON CONFLICT ("studentId", "academicYear") DO UPDATE
      SET "finalFee" = EXCLUDED."finalFee", "updatedAt" = EXCLUDED."updatedAt"
      RETURNING *
    `);
    const finance = records[0];
    return {
      status: "success" as const,
      message: "Fee details saved successfully",
      data: finance,
    };
  }

  static async addPayment(financeId: string, input: AddFinancePaymentInput) {
    const records = await db.$queryRaw<FinanceRecord[]>(
      Prisma.sql`SELECT * FROM "Finance" WHERE "id" = ${financeId} LIMIT 1`
    );
    const finance = records[0];
    if (!finance) throw new Error("Finance record not found");
    const paymentId = randomUUID();
    const paidAt = input.paidAt ?? new Date();
    const payments = await db.$queryRaw<FinancePayment[]>(Prisma.sql`
      INSERT INTO "FinancePayment" ("id", "financeId", "amount", "paidAt", "reference", "remarks", "createdAt")
      VALUES (${paymentId}, ${financeId}, ${input.amount}, ${paidAt}, ${input.reference || null}, ${input.remarks || null}, ${new Date()})
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
