import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { hallTicketHtml } from "@webcampus/ui/lib/hall-ticket";
import type { HallTicketTemplateData } from "@webcampus/ui/lib/hall-ticket-template";
import { academicEligibility } from "./academic-eligibility.service";
import type { StudentEligibility } from "./academic-eligibility.service";

const logoDataUri: string = (() => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const svgPath = path.resolve(
      __filename,
      "../../../../../../apps/web/public/bmsce.svg"
    );
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
};

export const hallTicketService = {
  async getStudentPeCourseIds(
    studentId: string,
    academicTermId: string
  ): Promise<string[]> {
    const regs = await db.courseRegistration.findMany({
      where: { studentId, academicTermId, course: { courseType: "PE" } },
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

  async list(
    filters: {
      departmentId?: string;
      academicTermId?: string;
      semesterId?: string;
      sectionId?: string;
      search?: string;
    } = {}
  ): Promise<HallTicketWithAcademics[]> {
    const { academicTermId, ...rest } = filters;
    if (!academicTermId) return [];

    logger.info(
      `[HallTicket] list filters: academicTermId=${academicTermId} semesterId=${rest.semesterId ?? "(none)"} departmentId=${rest.departmentId ?? "(none)"} sectionId=${rest.sectionId ?? "(none)"} search=${rest.search ?? "(none)"}`
    );

    const eligibleStudents = await academicEligibility.findEligibleStudents({
      academicTermId,
      ...rest,
    });

    const frozenStudents = eligibleStudents.filter((s) => s.allCoursesFrozen);
    if (frozenStudents.length === 0) return [];

    const peReady = await Promise.all(
      frozenStudents.map(async (s) =>
        (await this.isStudentPeReady(s.studentId, academicTermId)) ? s : null
      )
    );
    const readyFrozenStudents = peReady.filter(
      (s): s is (typeof frozenStudents)[number] => s !== null
    );
    if (readyFrozenStudents.length === 0) return [];

    const term = await db.academicTerm.findUnique({
      where: { id: academicTermId },
      select: { year: true, type: true },
    });
    const academicTermLabel = term
      ? `${term.type.toUpperCase()} ${term.year}`
      : "N/A";

    const studentIds = readyFrozenStudents.map((s) => s.studentId);
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
      },
    });

    const sendMap = new Map(sendRecords.map((r) => [r.studentId, r]));

    return readyFrozenStudents.map((student) => ({
      ...student,
      academicTermLabel,
      isSent: sendMap.get(student.studentId)?.isSent ?? false,
      sentAt: sendMap.get(student.studentId)?.sentAt?.toISOString() ?? null,
      sentBy: sendMap.get(student.studentId)?.sentBy ?? null,
    }));
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
            academicTerm: { select: { year: true, type: true } },
          },
        })
      : await db.hallTicket.findFirst({
          where: { studentId, academicTermId },
          select: {
            isSent: true,
            sentAt: true,
            sentBy: true,
            academicTerm: { select: { year: true, type: true } },
          },
        });

    const termLabel = sendRecord?.academicTerm
      ? `${sendRecord.academicTerm.type.toUpperCase()} ${sendRecord.academicTerm.year}`
      : "N/A";

    return {
      ...eligibility,
      academicTermLabel: termLabel,
      isSent: sendRecord?.isSent ?? false,
      sentAt: sendRecord?.sentAt?.toISOString() ?? null,
      sentBy: sendRecord?.sentBy ?? null,
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
        course: { courseType: "PE" },
      },
      select: { courseId: true },
    });
    const { PeCapacityService } = await import(
      "@webcampus/api/src/services/shared/pe-capacity.service"
    );
    for (const reg of peRegs) {
      await PeCapacityService.assertPeDownstreamReady(reg.courseId);
    }

    const data = await this.getData(studentId, academicTermId);
    if (!data) {
      logger.error(
        `[HallTicket] generatePdfHtml: data not found for student=${studentId} term=${academicTermId}`
      );
      throw new Error("Hall ticket data not found");
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
        status: c.eligible ? ("ELIGIBLE" as const) : ("NOT_ELIGIBLE" as const),
      })),
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
