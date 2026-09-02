import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "@webcampus/common/logger";
import { getTermLabel } from "@webcampus/common/term-label";
import { db } from "@webcampus/db";
import { hallTicketHtml } from "@webcampus/ui/lib/hall-ticket";
import type { HallTicketTemplateData } from "@webcampus/ui/lib/hall-ticket-template";
import { academicEligibility } from "./academic-eligibility.service";
import type {
  CourseEligibilityItem,
  StudentEligibility,
} from "./academic-eligibility.service";
import { REGULAR_ATTEMPT_REGISTRATION_TYPES } from "./course-registration-resolver";
import {
  buildQrPayload,
  hallTicketVerificationService,
} from "./hall-ticket-verification.service";

const logoDataUri: string = (() => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const svgPath =
      process.env.BMSCE_LOGO_PATH ??
      path.resolve(__filename, "../../../../../../apps/web/public/bmsce.svg");
    const svg = readFileSync(svgPath, "utf-8");
    const base64 = Buffer.from(svg, "utf-8").toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
  } catch {
    return "/bmsce.svg";
  }
})();

let browserInstance: import("puppeteer").Browser | null = null;

async function getBrowser(): Promise<import("puppeteer").Browser> {
  if (browserInstance && browserInstance.connected) return browserInstance;

  // Import the full puppeteer package
  const puppeteer = await import("puppeteer");
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  try {
    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    return browserInstance;
  } catch (err) {
    logger.error(
      `[HallTicket] Failed to launch browser: executablePath=${executablePath ?? "default"} error=${err instanceof Error ? err.message : String(err)}`
    );
    throw err;
  }
}

async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // A4 at 96 DPI: 793.7 x 1122.5 px
    await page.setViewport({ width: 794, height: 1123 });
    await page.emulateMediaType("screen");
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
      printBackground: true,
    });
    return Buffer.from(pdf);
  } catch (err) {
    logger.error(
      `[HallTicket] PDF generation failed: ${err instanceof Error ? err.message : String(err)}`
    );
    throw err;
  } finally {
    await page.close();
  }
}

type HallTicketWithAcademics = StudentEligibility & {
  academicTermLabel: string;
  isSent: boolean;
  sentAt: string | null;
  sentBy: string | null;
  verificationToken: string | null;
  peReady?: boolean;
  blockReason?: string | null;
};

export type BacklogPaperRow = {
  id: string;
  courseId: string;
  course: {
    code: string;
    name: string;
    courseType: string;
    totalCredits: number;
  };
};

export type ReappearExamRegistrationRow = BacklogPaperRow & {
  attemptNumber: number;
};

export function buildReappearPapers(
  rows: readonly BacklogPaperRow[],
  existingCourseIds: ReadonlySet<string>
): CourseEligibilityItem[] {
  const papers: CourseEligibilityItem[] = [];
  for (const row of rows) {
    if (existingCourseIds.has(row.courseId)) continue;
    papers.push({
      courseAssignmentId: row.id,
      courseCode: row.course.code,
      courseName: row.course.name,
      courseType: row.course.courseType,
      credits: row.course.totalCredits,
      cieTotal: null,
      attendancePercentage: null,
      isFrozen: true,
      markEligible: true,
      attendanceEligible: true,
      eligible: true,
      reason: null,
      isBacklog: true,
    });
  }
  return papers;
}

export const hallTicketService = {
  async getStudentPeCourseIds(
    studentId: string,
    academicTermId: string
  ): Promise<string[]> {
    const regs = await db.courseRegistration.findMany({
      where: {
        studentId,
        academicTermId,
        status: "ACTIVE",
        registrationType: { in: [...REGULAR_ATTEMPT_REGISTRATION_TYPES] },
        course: { courseType: { in: ["PE", "PW"] } },
      },
      select: { courseId: true },
    });
    return regs.map((r) => r.courseId);
  },

  async assertStudentPeReady(
    studentId: string,
    academicTermId: string
  ): Promise<void> {
    const { PeCapacityService } = await import(
      "@webcampus/api/src/services/shared/pe-capacity.service"
    );
    const peCourseIds = await this.getStudentPeCourseIds(
      studentId,
      academicTermId
    );
    for (const courseId of peCourseIds) {
      await PeCapacityService.assertPeDownstreamReady(courseId);
    }
  },

  async isStudentPeReady(
    studentId: string,
    academicTermId: string
  ): Promise<boolean> {
    try {
      await this.assertStudentPeReady(studentId, academicTermId);
      return true;
    } catch {
      return false;
    }
  },

  async getActiveRegistrationCourseIds(
    studentIds: string[],
    academicTermId: string
  ): Promise<Map<string, Set<string>>> {
    const regs = await db.courseRegistration.findMany({
      where: {
        studentId: { in: studentIds },
        academicTermId,
        status: "ACTIVE",
        registrationType: { in: [...REGULAR_ATTEMPT_REGISTRATION_TYPES] },
      },
      select: { studentId: true, courseId: true },
    });
    const map = new Map<string, Set<string>>();
    for (const reg of regs) {
      const set = map.get(reg.studentId) ?? new Set<string>();
      set.add(reg.courseId);
      map.set(reg.studentId, set);
    }
    return map;
  },

  async getReappearExamRegistrations(
    studentIds: string[],
    academicTermId: string
  ): Promise<Map<string, ReappearExamRegistrationRow[]>> {
    const rows = await db.examRegistration.findMany({
      where: {
        studentId: { in: studentIds },
        academicTermId,
        examType: "REAPPEAR",
        status: { not: "CANCELLED" },
      },
      orderBy: { attemptNumber: "asc" },
      select: {
        id: true,
        studentId: true,
        courseId: true,
        attemptNumber: true,
        course: {
          select: {
            code: true,
            name: true,
            courseType: true,
            totalCredits: true,
          },
        },
      },
    });
    const map = new Map<string, ReappearExamRegistrationRow[]>();
    for (const row of rows) {
      const list = map.get(row.studentId) ?? [];
      list.push({
        id: row.id,
        courseId: row.courseId,
        attemptNumber: row.attemptNumber,
        course: row.course,
      });
      map.set(row.studentId, list);
    }
    return map;
  },

  async getActiveSupplementaryRegistrations(
    studentIds: string[],
    academicTermId: string
  ): Promise<Map<string, BacklogPaperRow[]>> {
    const rows = await db.courseRegistration.findMany({
      where: {
        studentId: { in: studentIds },
        academicTermId,
        status: "ACTIVE",
        registrationType: "SUPPLEMENTARY",
      },
      orderBy: { registrationDate: "asc" },
      select: {
        id: true,
        studentId: true,
        courseId: true,
        course: {
          select: {
            code: true,
            name: true,
            courseType: true,
            totalCredits: true,
          },
        },
      },
    });
    const map = new Map<string, BacklogPaperRow[]>();
    for (const row of rows) {
      const list = map.get(row.studentId) ?? [];
      list.push({ id: row.id, courseId: row.courseId, course: row.course });
      map.set(row.studentId, list);
    }
    return map;
  },

  async list(
    filters: {
      departmentId?: string;
      academicTermId?: string;
      semesterId?: string;
      sectionId?: string;
      cycle?: "PHYSICS" | "CHEMISTRY";
      search?: string;
    } = {}
  ): Promise<HallTicketWithAcademics[]> {
    const { academicTermId, ...rest } = filters;
    if (!academicTermId) return [];

    logger.info(
      `[HallTicket] list filters: academicTermId=${academicTermId} semesterId=${rest.semesterId ?? "(none)"} departmentId=${rest.departmentId ?? "(none)"} sectionId=${rest.sectionId ?? "(none)"} cycle=${rest.cycle ?? "(none)"} search=${rest.search ?? "(none)"}`
    );

    const eligibleStudents = await academicEligibility.findEligibleStudents({
      academicTermId,
      ...rest,
    });
    if (eligibleStudents.length === 0) return [];

    const term = await db.academicTerm.findUnique({
      where: { id: academicTermId },
      select: { year: true, type: true, parity: true },
    });
    const academicTermLabel = term
      ? getTermLabel(term.type, term.year, term.parity)
      : "N/A";

    const studentIds = eligibleStudents.map((s) => s.studentId);
    const sendRecords = await db.hallTicket.findMany({
      where: {
        studentId: { in: studentIds },
        academicTermId,
        ...(rest.semesterId ? { semesterId: rest.semesterId } : {}),
      },
      select: {
        studentId: true,
        isSent: true,
        sentAt: true,
        sentBy: true,
        verificationToken: true,
      },
    });

    const sendMap = new Map(sendRecords.map((r) => [r.studentId, r]));

    const peReadyMap = new Map<string, boolean>();
    for (const student of eligibleStudents) {
      if (student.allCoursesFrozen) {
        peReadyMap.set(
          student.studentId,
          await this.isStudentPeReady(student.studentId, academicTermId)
        );
      } else {
        peReadyMap.set(student.studentId, true);
      }
    }

    const activeCourseIds = await this.getActiveRegistrationCourseIds(
      studentIds,
      academicTermId
    );
    const reappearByStudent = await this.getReappearExamRegistrations(
      studentIds,
      academicTermId
    );
    const supplementaryByStudent =
      await this.getActiveSupplementaryRegistrations(
        studentIds,
        academicTermId
      );

    return eligibleStudents.map((student) => {
      const backlogRows = [
        ...(reappearByStudent.get(student.studentId) ?? []),
        ...(supplementaryByStudent.get(student.studentId) ?? []),
      ];
      const exclude =
        activeCourseIds.get(student.studentId) ??
        new Set(student.courses.map((c) => c.courseAssignmentId));
      const mergedCourses = [
        ...student.courses,
        ...buildReappearPapers(backlogRows, exclude),
      ];
      const peReady = peReadyMap.get(student.studentId) ?? false;
      let blockReason: string | null = null;
      if (!student.allCoursesFrozen) {
        const blocked = student.courses.filter((c) => !c.isFrozen);
        blockReason =
          blocked.length > 0
            ? blocked
                .map((c) => `${c.courseCode}: ${c.reason ?? "not frozen"}`)
                .join("; ")
            : "Not all courses are frozen";
      } else if (!peReady) {
        blockReason = "PE course mapping is not complete";
      }
      return {
        ...student,
        courses: mergedCourses,
        academicTermLabel,
        isSent: sendMap.get(student.studentId)?.isSent ?? false,
        sentAt: sendMap.get(student.studentId)?.sentAt?.toISOString() ?? null,
        sentBy: sendMap.get(student.studentId)?.sentBy ?? null,
        verificationToken:
          sendMap.get(student.studentId)?.verificationToken ?? null,
        peReady,
        blockReason,
      };
    });
  },

  async unsend(params: {
    studentIds: string[];
    academicTermId: string;
    semesterId: string;
  }): Promise<{ updated: number }> {
    const { studentIds, academicTermId, semesterId } = params;

    const result = await db.hallTicket.updateMany({
      where: {
        studentId: { in: studentIds },
        academicTermId,
        semesterId,
        isSent: true,
      },
      data: {
        isSent: false,
        sentAt: null,
        sentBy: null,
      },
    });

    logger.info(
      `[HallTicket] Unsent hall tickets for ${result.count} students (term: ${academicTermId})`
    );

    return { updated: result.count };
  },

  async send(
    params: {
      studentIds: string[];
      academicTermId: string;
      semesterId: string;
    },
    sentByUsername: string
  ): Promise<void> {
    const { studentIds, academicTermId, semesterId } = params;

    const semester = await db.semester.findUnique({
      where: { id: semesterId },
    });
    if (!semester) {
      throw new Error(`Semester not found: ${semesterId}`);
    }

    const errors: { studentId: string; error: string }[] = [];

    for (const studentId of studentIds) {
      try {
        if (!(await this.isStudentPeReady(studentId, academicTermId))) {
          errors.push({
            studentId,
            error: "PE course mapping is not complete",
          });
          continue;
        }
        const eligibility = await academicEligibility.getCourseEligibility(
          studentId,
          academicTermId
        );
        if (!eligibility) {
          errors.push({
            studentId,
            error: "Student not found or no registrations",
          });
          continue;
        }
        if (!eligibility.allCoursesFrozen) {
          errors.push({ studentId, error: "Not all courses are frozen" });
          continue;
        }

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
            isSent: true,
            sentAt: new Date(),
            sentBy: sentByUsername,
            verificationToken: hallTicketVerificationService.generateToken(),
          },
          update: {
            isSent: true,
            sentAt: new Date(),
            sentBy: sentByUsername,
          },
        });
      } catch (err) {
        errors.push({
          studentId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    if (errors.length > 0) {
      const msg = `Send completed with errors: ${errors.map((e) => `${e.studentId}: ${e.error}`).join("; ")}`;
      logger.error(`[HallTicket] ${msg}`);
      throw new Error(msg);
    }
    logger.info(
      `[HallTicket] Sent hall tickets for ${studentIds.length} students (term: ${academicTermId})`
    );
  },

  async getData(
    studentId: string,
    academicTermId: string,
    semesterId?: string
  ): Promise<HallTicketWithAcademics | null> {
    const eligibility = await academicEligibility.getCourseEligibility(
      studentId,
      academicTermId
    );
    if (!eligibility) {
      logger.warn(
        `[HallTicket] getData: no eligibility for student=${studentId} term=${academicTermId}`
      );
      return null;
    }

    if (!(await this.isStudentPeReady(studentId, academicTermId))) {
      logger.warn(
        `[HallTicket] getData: PE mapping not complete for student=${studentId} term=${academicTermId}`
      );
      return null;
    }

    const sendRecord = semesterId
      ? await db.hallTicket.findUnique({
          where: {
            studentId_academicTermId_semesterId: {
              studentId,
              academicTermId,
              semesterId,
            },
          },
          select: {
            isSent: true,
            sentAt: true,
            sentBy: true,
            verificationToken: true,
            academicTerm: { select: { year: true, type: true, parity: true } },
          },
        })
      : await db.hallTicket.findFirst({
          where: { studentId, academicTermId },
          select: {
            isSent: true,
            sentAt: true,
            sentBy: true,
            verificationToken: true,
            academicTerm: { select: { year: true, type: true, parity: true } },
          },
        });

    const termLabel = sendRecord?.academicTerm
      ? `${sendRecord.academicTerm.type.toUpperCase()} ${sendRecord.academicTerm.year}`
      : "N/A";

    const activeCourseIds = await this.getActiveRegistrationCourseIds(
      [studentId],
      academicTermId
    );
    const reappearByStudent = await this.getReappearExamRegistrations(
      [studentId],
      academicTermId
    );
    const supplementaryByStudent =
      await this.getActiveSupplementaryRegistrations(
        [studentId],
        academicTermId
      );
    const backlogRows = [
      ...(reappearByStudent.get(studentId) ?? []),
      ...(supplementaryByStudent.get(studentId) ?? []),
    ];
    const exclude =
      activeCourseIds.get(studentId) ??
      new Set(eligibility.courses.map((c) => c.courseAssignmentId));

    return {
      ...eligibility,
      courses: [
        ...eligibility.courses,
        ...buildReappearPapers(backlogRows, exclude),
      ],
      academicTermLabel: termLabel,
      isSent: sendRecord?.isSent ?? false,
      sentAt: sendRecord?.sentAt?.toISOString() ?? null,
      sentBy: sendRecord?.sentBy ?? null,
      verificationToken: sendRecord?.verificationToken ?? null,
    };
  },

  async getStudentForUser(
    userId: string
  ): Promise<{ id: string; currentSemester: number } | null> {
    return db.student.findUnique({
      where: { userId },
      select: { id: true, currentSemester: true },
    });
  },

  async getCurrentAcademicTerm(): Promise<{ id: string } | null> {
    return db.academicTerm.findFirst({
      where: { isCurrent: true },
      select: { id: true },
    });
  },

  async getStudentHallTickets(
    studentId: string,
    academicTermId: string
  ): Promise<HallTicketWithAcademics | null> {
    return this.getData(studentId, academicTermId);
  },

  async generatePdfHtml(
    studentId: string,
    academicTermId: string
  ): Promise<string> {
    const peRegs = await db.courseRegistration.findMany({
      where: {
        studentId,
        academicTermId,
        status: "ACTIVE",
        registrationType: { in: [...REGULAR_ATTEMPT_REGISTRATION_TYPES] },
        course: { courseType: { in: ["PE", "PW"] } },
      },
      select: { courseId: true },
    });
    const { PeCapacityService } = await import(
      "@webcampus/api/src/services/shared/pe-capacity.service"
    );
    for (const reg of peRegs) {
      await PeCapacityService.assertPeDownstreamReady(reg.courseId);
    }

    const studentRecord = await db.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { name: true, image: true } },
        admission: { select: { photo: true } },
      },
    });
    if (!studentRecord) {
      logger.error(
        `[HallTicket] generatePdfHtml: student record not found id=${studentId}`
      );
      throw new Error("Student not found");
    }

    const photo =
      studentRecord.admission?.photo ?? studentRecord.user.image ?? null;

    const data = await this.getData(studentId, academicTermId);
    if (!data) {
      logger.error(
        `[HallTicket] generatePdfHtml: data not found for student=${studentId} term=${academicTermId}`
      );
      throw new Error("Hall ticket data not found");
    }

    const sendRecord = await db.hallTicket.findFirst({
      where: { studentId, academicTermId },
      orderBy: { sentAt: "desc" },
    });

    const qrPayload = sendRecord
      ? buildQrPayload(
          sendRecord.verificationToken ??
            (await hallTicketVerificationService.ensureVerificationToken(
              studentId,
              academicTermId,
              sendRecord.semesterId
            ))
        )
      : undefined;

    const templateData: HallTicketTemplateData = {
      id: `${studentId}-${academicTermId}`,
      isSent: data.isSent,
      sentAt: data.sentAt,
      sentBy: data.sentBy,
      generatedAt: new Date().toISOString(),
      student: {
        usn: data.usn,
        name: data.name,
        photo,
        departmentName: data.departmentName,
        currentSemester: data.currentSemester,
        programType: studentRecord.programType ?? null,
        academicTermLabel: data.academicTermLabel,
        sectionName: data.sectionName,
      },
      courses: data.courses.map((c) => ({
        courseAssignmentId: c.courseAssignmentId,
        courseCode: c.courseCode,
        courseName: c.courseName,
        courseType: c.courseType,
        credits: c.credits,
        cieTotal: c.cieTotal,
        attendancePercentage: c.attendancePercentage,
        isFrozen: c.isFrozen,
        markEligible: c.markEligible,
        attendanceEligible: c.attendanceEligible,
        eligible: c.eligible,
        isBacklog: c.isBacklog,
        status: c.eligible ? ("ELIGIBLE" as const) : ("NOT_ELIGIBLE" as const),
      })),
      qrPayload,
    };

    return hallTicketHtml(templateData, logoDataUri);
  },

  async generatePdfBuffer(
    studentId: string,
    academicTermId: string
  ): Promise<Buffer> {
    const html = await this.generatePdfHtml(studentId, academicTermId);
    return generatePdfFromHtml(html);
  },

  async getAcademicTerms(): Promise<{ id: string; label: string }[]> {
    const terms = await db.academicTerm.findMany({
      orderBy: [{ year: "desc" }, { type: "desc" }],
    });
    return terms.map((t) => ({
      id: t.id,
      label: `${t.year} - ${t.type === "odd" ? "Odd" : "Even"}`,
    }));
  },

  async getDepartments(): Promise<{ id: string; name: string }[]> {
    return db.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  },
};
