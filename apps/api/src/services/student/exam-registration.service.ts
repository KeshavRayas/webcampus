import { isRegistrationWindowOpen } from "@webcampus/api/src/services/shared/academic-rules/academic-rules.service";
import type {
  CourseOutcomeValue,
  ExamRegistrationStatusValue,
  RegistrationStatusValue,
  RegistrationTypeValue,
} from "@webcampus/api/src/services/shared/academic-rules/academic-rules.types";
import { computeAttemptSummary } from "@webcampus/api/src/services/shared/academic-rules/attempt-rules";
import { deriveLatestOutcome } from "@webcampus/api/src/services/shared/academic-rules/exam-rules";
import { canReappearForExam } from "@webcampus/api/src/services/shared/academic-rules/registration-rules";
import { logger } from "@webcampus/common/logger";
import { getTermLabel } from "@webcampus/common/term-label";
import { db, Prisma } from "@webcampus/db";
import {
  ExamRegistrationCandidateType,
  ExamRegistrationHistoryItemType,
  SubmitExamRegistrationResponseType,
  SubmitExamRegistrationType,
} from "@webcampus/schemas/student";
import { BaseResponse } from "@webcampus/types/api";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);

interface ExamSignupContext {
  studentId: string;
  departmentName: string;
  departmentId: string | null;
  semesterId: string;
  academicTermId: string;
  currentSemester: number;
  programType: "UG" | "PG";
  cycle: "PHYSICS" | "CHEMISTRY" | null;
}

interface PriorAttemptExamRow {
  status: ExamRegistrationStatusValue;
  outcome: CourseOutcomeValue;
  attemptNumber: number;
  registeredAt: Date;
}

interface PriorAttemptRow {
  id: string;
  courseId: string;
  status: RegistrationStatusValue;
  registrationType: RegistrationTypeValue;
  course: {
    code: string;
    name: string;
    courseType: string;
  };
  semester: { semesterNumber: number };
  academicTerm: { type: string; year: string; parity?: "odd" | "even" | null };
  examRegistrations: PriorAttemptExamRow[];
}

export const REAPPEAR_ALREADY_REGISTERED_REASON = "REAPPEAR_ALREADY_REGISTERED";

async function getContext(userId: string): Promise<ExamSignupContext> {
  const student = await db.student.findFirst({
    where: { user: { id: userId } },
    select: {
      id: true,
      departmentName: true,
      semesterId: true,
      academicTermId: true,
      currentSemester: true,
      programType: true,
      studentSections: { select: { section: { select: { cycle: true } } } },
    },
  });

  if (!student) {
    throw new Error("Student profile not found");
  }

  if (
    !student.semesterId ||
    !student.academicTermId ||
    !student.programType ||
    !student.currentSemester
  ) {
    throw new Error("Student academic context is incomplete");
  }

  const department = await db.department.findUnique({
    where: { name: student.departmentName },
    select: { id: true },
  });

  let cycle: "PHYSICS" | "CHEMISTRY" | null = null;

  const firstCycle = student.studentSections.at(0)?.section.cycle ?? null;

  if (
    student.programType === "UG" &&
    FIRST_YEAR_UG_SEMESTERS.has(student.currentSemester)
  ) {
    cycle =
      firstCycle === "PHYSICS" || firstCycle === "CHEMISTRY"
        ? firstCycle
        : null;

    if (cycle === null) {
      throw new Error(
        "Unable to resolve student cycle for examination registration"
      );
    }
  }

  return {
    studentId: student.id,
    departmentName: student.departmentName,
    departmentId: department?.id ?? null,
    semesterId: student.semesterId,
    academicTermId: student.academicTermId,
    currentSemester: student.currentSemester,
    programType: student.programType,
    cycle,
  };
}

async function fetchPriorAttempts(
  studentId: string,
  courseIds?: string[]
): Promise<PriorAttemptRow[]> {
  return db.courseRegistration.findMany({
    where: {
      studentId,
      status: "ACTIVE",
      registrationType: { in: ["REGULAR", "RE_REGISTRATION"] },
      ...(courseIds ? { courseId: { in: courseIds } } : {}),
    },
    orderBy: { registrationDate: "desc" },
    select: {
      id: true,
      courseId: true,
      status: true,
      registrationType: true,
      course: { select: { code: true, name: true, courseType: true } },
      semester: { select: { semesterNumber: true } },
      academicTerm: {
        select: { id: true, type: true, parity: true, year: true },
      },
      examRegistrations: {
        where: { status: { not: "CANCELLED" } },
        select: {
          status: true,
          outcome: true,
          attemptNumber: true,
          registeredAt: true,
        },
      },
    },
  });
}

export function buildReappearCandidate(
  prior: PriorAttemptRow,
  hasActiveExamRegistration: boolean
): ExamRegistrationCandidateType {
  const latest = deriveLatestOutcome(prior.examRegistrations);
  const verdict = canReappearForExam(latest?.outcome ?? "PENDING", true);
  const attempts = computeAttemptSummary([prior], prior.examRegistrations);

  const eligible = verdict.allowed && !hasActiveExamRegistration;

  return {
    courseId: prior.courseId,
    code: prior.course.code,
    name: prior.course.name,
    courseType: prior.course.courseType,
    semesterLabel: `Sem ${prior.semester.semesterNumber}`,
    academicTermLabel: getTermLabel(
      prior.academicTerm.type,
      prior.academicTerm.year,
      prior.academicTerm.parity
    ),
    attemptCount: attempts.attemptCount,
    nextAttemptNumber: attempts.nextAttemptNumber,
    latestOutcome: latest?.outcome ?? null,
    hasActiveExamRegistration,
    eligible,
    reasons: [
      ...verdict.reasons,
      ...(hasActiveExamRegistration
        ? [REAPPEAR_ALREADY_REGISTERED_REASON]
        : []),
    ],
    warnings: attempts.warnings,
  };
}

function getWindowScope(student: ExamSignupContext) {
  return {
    academicTermId: student.academicTermId,
    semesterId: student.semesterId,
    ...(student.cycle
      ? { cycle: student.cycle }
      : { departmentId: student.departmentId }),
  };
}

export class ExamRegistrationService {
  static async getEligibleCourses(
    userId: string
  ): Promise<
    BaseResponse<{
      isOpen: boolean;
      candidates: ExamRegistrationCandidateType[];
    }>
  > {
    try {
      const student = await getContext(userId);

      const [priors, activeExams, windowState] = await Promise.all([
        fetchPriorAttempts(student.studentId),
        db.examRegistration.findMany({
          where: {
            studentId: student.studentId,
            academicTermId: student.academicTermId,
            examType: "REAPPEAR",
            status: { not: "CANCELLED" },
          },
          select: { courseId: true },
        }),
        isRegistrationWindowOpen({
          registrationType: "SUPPLEMENTARY",
          ...getWindowScope(student),
        }),
      ]);

      const activeCourseIds = new Set(activeExams.map((row) => row.courseId));

      const byCourse = new Map<string, PriorAttemptRow>();
      for (const prior of priors) {
        if (!byCourse.has(prior.courseId)) {
          byCourse.set(prior.courseId, prior);
        }
      }

      const candidates = Array.from(byCourse.values()).map((prior) =>
        buildReappearCandidate(prior, activeCourseIds.has(prior.courseId))
      );

      return {
        status: "success",
        message: "Examination eligibility fetched successfully",
        data: { isOpen: windowState.open, candidates },
      };
    } catch (error) {
      logger.error("Failed to fetch examination eligibility", error);
      throw error;
    }
  }

  static async submitExamRegistrations(
    userId: string,
    input: SubmitExamRegistrationType
  ): Promise<BaseResponse<SubmitExamRegistrationResponseType>> {
    try {
      const student = await getContext(userId);

      const windowState = await isRegistrationWindowOpen({
        registrationType: "SUPPLEMENTARY",
        ...getWindowScope(student),
      });

      if (!windowState.open) {
        throw new Error(
          `Examination registration window is closed (${windowState.reason ?? "unavailable"})`
        );
      }

      const uniqueCourseIds = Array.from(new Set(input.courseIds));

      const [priors, activeExams] = await Promise.all([
        fetchPriorAttempts(student.studentId, uniqueCourseIds),
        db.examRegistration.findMany({
          where: {
            studentId: student.studentId,
            academicTermId: student.academicTermId,
            examType: "REAPPEAR",
            status: { not: "CANCELLED" },
            courseId: { in: uniqueCourseIds },
          },
          select: {
            courseId: true,
            course: { select: { code: true } },
          },
        }),
      ]);

      const byCourse = new Map<string, PriorAttemptRow>();
      for (const prior of priors) {
        if (!byCourse.has(prior.courseId)) {
          byCourse.set(prior.courseId, prior);
        }
      }

      const activeByCourse = new Map<string, string>();
      for (const row of activeExams) {
        if (!activeByCourse.has(row.courseId)) {
          activeByCourse.set(row.courseId, row.course.code);
        }
      }

      const selected: PriorAttemptRow[] = [];

      for (const courseId of uniqueCourseIds) {
        const prior = byCourse.get(courseId);

        if (!prior) {
          throw new Error(
            "No completed attempt found for one or more selected courses"
          );
        }

        const activeCode = activeByCourse.get(courseId);

        if (activeCode) {
          throw new Error(
            `A reappear registration already exists for ${activeCode}`
          );
        }

        const latest = deriveLatestOutcome(prior.examRegistrations);
        const verdict = canReappearForExam(latest?.outcome ?? "PENDING", true);

        if (!verdict.allowed) {
          throw new Error(
            `Cannot register for the reappear exam of ${prior.course.code}: ${verdict.reasons.join(", ")}`
          );
        }

        selected.push(prior);
      }

      await db.$transaction(async (tx) => {
        for (const prior of selected) {
          const attempts = computeAttemptSummary(
            [prior],
            prior.examRegistrations
          );
          const latest = deriveLatestOutcome(prior.examRegistrations);
          const outcome = latest?.outcome ?? "PENDING";

          await tx.examRegistration.create({
            data: {
              studentId: student.studentId,
              courseId: prior.courseId,
              academicTermId: student.academicTermId,
              sourceCourseRegistrationId: prior.id,
              examType: "REAPPEAR",
              attemptNumber: attempts.nextAttemptNumber,
              eligibleAtRegistration: outcome === "F" || outcome === "X",
              eligibilitySnapshot: {
                latestOutcome: outcome,
                attemptCount: attempts.attemptCount,
                warnings: attempts.warnings,
              },
            },
          });
        }
      });

      logger.info("Reappear exam registrations submitted", {
        studentId: student.studentId,
        count: selected.length,
      });

      return {
        status: "success",
        message: "Examination registrations submitted successfully",
        data: { count: selected.length },
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error(
          "A reappear registration already exists for one of these courses"
        );
      }
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Failed to submit examination registrations", error);
      throw new Error("Failed to submit examination registrations");
    }
  }

  static async getHistory(
    userId: string
  ): Promise<BaseResponse<ExamRegistrationHistoryItemType[]>> {
    try {
      const student = await getContext(userId);

      const registrations = await db.examRegistration.findMany({
        where: {
          studentId: student.studentId,
          examType: "REAPPEAR",
        },
        orderBy: { registeredAt: "desc" },
        select: {
          id: true,
          courseId: true,
          examType: true,
          attemptNumber: true,
          status: true,
          outcome: true,
          seeMarks: true,
          maxSeeMarks: true,
          registeredAt: true,
          course: { select: { code: true, name: true } },
          academicTerm: {
            select: { id: true, type: true, parity: true, year: true },
          },
        },
      });

      return {
        status: "success",
        message: "Examination history fetched successfully",
        data: registrations.map((registration) => ({
          id: registration.id,
          courseId: registration.courseId,
          code: registration.course.code,
          name: registration.course.name,
          academicTermLabel: getTermLabel(
            registration.academicTerm.type,
            registration.academicTerm.year,
            registration.academicTerm.parity
          ),
          examType: registration.examType,
          attemptNumber: registration.attemptNumber,
          status: registration.status,
          outcome: registration.outcome,
          seeMarks: registration.seeMarks,
          maxSeeMarks: registration.maxSeeMarks,
          registeredAt: registration.registeredAt.toISOString(),
        })),
      };
    } catch (error) {
      logger.error("Failed to fetch examination history", error);
      throw error;
    }
  }
}
