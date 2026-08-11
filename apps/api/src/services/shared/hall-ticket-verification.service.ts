import { randomBytes } from "crypto";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { academicEligibility } from "./academic-eligibility.service";

const QR_PREFIX = "WCHT_VERIFY:";

export type VerificationOutcome =
  | "VALID"
  | "NOT_ELIGIBLE"
  | "NOT_SENT"
  | "NOT_FOUND"
  | "INACTIVE"
  | "WINDOW_CLOSED";

type VerifyParams = {
  token: string;
};

type VerifierContext = {
  userId?: string;
  role?: string;
};

function normalizeToken(raw: string): string {
  return raw.startsWith(QR_PREFIX) ? raw.slice(QR_PREFIX.length) : raw;
}

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export function buildQrPayload(token: string): string {
  return `${QR_PREFIX}${token}`;
}

function isWindowActive(
  setting: { windowStartAt: Date | null; windowEndAt: Date | null },
  now: Date
): boolean {
  if (setting.windowStartAt && now < setting.windowStartAt) return false;
  if (setting.windowEndAt && now > setting.windowEndAt) return false;
  return true;
}

export const hallTicketVerificationService = {
  generateToken,

  async ensureVerificationToken(
    studentId: string,
    academicTermId: string,
    semesterId: string
  ): Promise<string> {
    const existing = await db.hallTicket.findUnique({
      where: {
        studentId_academicTermId_semesterId: {
          studentId,
          academicTermId,
          semesterId,
        },
      },
      select: { verificationToken: true },
    });
    if (existing?.verificationToken) return existing.verificationToken;

    const token = generateToken();
    await db.hallTicket.upsert({
      where: {
        studentId_academicTermId_semesterId: {
          studentId,
          academicTermId,
          semesterId,
        },
      },
      create: {
        studentId,
        academicTermId,
        semesterId,
        verificationToken: token,
      },
      update: { verificationToken: token },
    });
    return token;
  },

  async getSetting(academicTermId: string) {
    return db.hallTicketVerificationSetting.findUnique({
      where: { academicTermId },
    });
  },

  async upsertSetting(params: {
    academicTermId: string;
    enabled: boolean;
    windowStartAt?: string | null;
    windowEndAt?: string | null;
    updatedById?: string;
  }) {
    const { academicTermId, enabled, windowStartAt, windowEndAt, updatedById } =
      params;
    return db.hallTicketVerificationSetting.upsert({
      where: { academicTermId },
      create: {
        academicTermId,
        enabled,
        windowStartAt: windowStartAt ? new Date(windowStartAt) : null,
        windowEndAt: windowEndAt ? new Date(windowEndAt) : null,
        updatedById,
      },
      update: {
        enabled,
        windowStartAt: windowStartAt ? new Date(windowStartAt) : null,
        windowEndAt: windowEndAt ? new Date(windowEndAt) : null,
        updatedById,
      },
    });
  },

  async listSettings() {
    return db.hallTicketVerificationSetting.findMany({
      orderBy: { updatedAt: "desc" },
      include: { academicTerm: { select: { type: true, year: true } } },
    });
  },

  async listLogs(params: {
    page: number;
    limit: number;
    academicTermId?: string;
    result?: string;
  }) {
    const { page, limit, academicTermId, result } = params;
    const where = {
      ...(academicTermId ? { academicTermId } : {}),
      ...(result ? { result } : {}),
    };
    const [total, items] = await Promise.all([
      db.hallTicketVerificationLog.count({ where }),
      db.hallTicketVerificationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          student: { select: { usn: true } },
          academicTerm: { select: { type: true, year: true } },
        },
      }),
    ]);
    return { total, page, limit, items };
  },

  async verify(params: VerifyParams, context: VerifierContext) {
    const now = new Date();

    const token = normalizeToken(params.token);
    const record = await db.hallTicket.findUnique({
      where: { verificationToken: token },
    });
    if (!record) {
      logger.warn(`[Verification] token not found: ${token.slice(0, 12)}...`);
      return {
        valid: false,
        result: "NOT_FOUND",
        detail:
          "No hall ticket matches this QR code. Only current, token-based hall tickets are supported.",
        student: null,
      };
    }

    const { studentId, academicTermId } = record;

    const sendRecord = await db.hallTicket.findFirst({
      where: { studentId, academicTermId },
      orderBy: { sentAt: "desc" },
    });

    if (!sendRecord) {
      return {
        valid: false,
        result: "NOT_FOUND",
        detail: "No hall ticket record found for this term.",
        student: null,
      };
    }

    if (!sendRecord.isSent) {
      return {
        valid: false,
        result: "NOT_SENT",
        detail: "Hall ticket has not been issued by the examination office.",
        student: null,
      };
    }

    const setting = await this.getSetting(academicTermId);
    if (!setting || !setting.enabled) {
      return {
        valid: false,
        result: "INACTIVE",
        detail: "QR verification is currently disabled for this term.",
        student: null,
      };
    }
    if (!isWindowActive(setting, now)) {
      return {
        valid: false,
        result: "WINDOW_CLOSED",
        detail: "QR verification is not active for this term right now.",
        student: null,
      };
    }

    const eligibility = await academicEligibility.getCourseEligibility(
      studentId,
      academicTermId
    );

    if (!eligibility) {
      return {
        valid: false,
        result: "NOT_FOUND",
        detail: "No course eligibility data found for this student.",
        student: null,
      };
    }

    const term = await db.academicTerm.findUnique({
      where: { id: academicTermId },
      select: { year: true, type: true },
    });
    const academicTermLabel = term
      ? `${term.type.toUpperCase()} ${term.year}`
      : "N/A";

    const student = {
      studentId,
      usn: eligibility.usn,
      name: eligibility.name,
      photo: eligibility.photo,
      departmentName: eligibility.departmentName,
      currentSemester: eligibility.currentSemester,
      programType: eligibility.programType,
      academicTermLabel,
      sectionName: eligibility.sectionName,
      isSent: sendRecord.isSent,
    };

    const courses = eligibility.courses.map((c) => ({
      courseCode: c.courseCode,
      courseName: c.courseName,
      courseType: c.courseType,
      credits: c.credits,
      cieTotal: c.cieTotal,
      attendancePercentage: c.attendancePercentage,
      eligible: c.eligible,
      reason: c.reason,
    }));

    const allEligible = eligibility.eligible;
    const blocking = eligibility.courses
      .filter((c) => !c.eligible)
      .map((c) => `${c.courseCode}: ${c.reason ?? "not eligible"}`);
    const result: VerificationOutcome = allEligible ? "VALID" : "NOT_ELIGIBLE";
    const detail = allEligible
      ? "Student is eligible for all registered courses."
      : `Not eligible for: ${blocking.join("; ")}`;

    await db.hallTicketVerificationLog.create({
      data: {
        studentId,
        academicTermId,
        token,
        verifiedById: context.userId,
        verifiedByRole: context.role,
        result,
        detail,
      },
    });

    logger.info(
      `[Verification] ${result} student=${studentId} term=${academicTermId} by=${context.role ?? "unknown"}`
    );

    return { valid: allEligible, result, detail, student, courses };
  },
};
