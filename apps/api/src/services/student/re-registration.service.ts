import { logger } from "@webcampus/common/logger";
import { getTermLabel } from "@webcampus/common/term-label";
import { db, Prisma } from "@webcampus/db";
import type {
  ReRegistrationCandidateType,
  ReRegistrationHistoryItemType,
  SubmitReRegistrationResponseType,
} from "@webcampus/schemas/student";
import type { BaseResponse } from "@webcampus/types/api";
import { isRegistrationWindowOpen } from "../shared/academic-rules/academic-rules.service";
import type {
  CourseOutcomeValue,
  ExamRegistrationStatusValue,
  RegistrationStatusValue,
  RegistrationTypeValue,
} from "../shared/academic-rules/academic-rules.types";
import { computeAttemptSummary } from "../shared/academic-rules/attempt-rules";
import { checkCreditLimit } from "../shared/academic-rules/credit-limit.service";
import { deriveLatestOutcome } from "../shared/academic-rules/exam-rules";
import { canReRegister } from "../shared/academic-rules/registration-rules";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);

type ReRegistrationContext = {
  id: string;
  departmentName: string;
  semesterId: string;
  academicTermId: string;
  currentSemester: number;
  programType: "UG" | "PG";
  studentSections: { section: { cycle: "PHYSICS" | "CHEMISTRY" | "NONE" } }[];
};

type PriorAttemptRow = {
  id: string;
  courseId: string;
  semesterId: string;
  academicTermId: string;
  status: RegistrationStatusValue;
  registrationType: RegistrationTypeValue;
  course: {
    id: string;
    code: string;
    name: string;
    courseType: string;
    totalCredits: number;
  };
  semester: { semesterNumber: number; programType: string };
  academicTerm: { type: string; year: string; parity?: "odd" | "even" | null };
  examRegistrations: {
    id: string;
    status: ExamRegistrationStatusValue;
    outcome: CourseOutcomeValue;
    attemptNumber: number;
    registeredAt: Date;
  }[];
};

export const RE_REGISTRATION_IN_PROGRESS_REASON =
  "RE_REGISTRATION_ALREADY_IN_PROGRESS";

function getSemesterLabel(programType: string, semesterNumber: number): string {
  return `${programType} Semester ${semesterNumber}`;
}

async function getContext(userId: string): Promise<ReRegistrationContext> {
  const student = await db.student.findUnique({
    where: { userId },
    select: {
      id: true,
      departmentName: true,
      semesterId: true,
      academicTermId: true,
      currentSemester: true,
      programType: true,
      studentSections: {
        select: { section: { select: { cycle: true } } },
      },
    },
  });

  if (!student) {
    throw new Error("Student profile not found");
  }

  if (!student.semesterId || !student.academicTermId || !student.programType) {
    throw new Error("Student academic context is incomplete");
  }

  return {
    id: student.id,
    departmentName: student.departmentName,
    semesterId: student.semesterId,
    academicTermId: student.academicTermId,
    currentSemester: student.currentSemester,
    programType: student.programType,
    studentSections: student.studentSections,
  };
}

async function resolveScope(student: ReRegistrationContext): Promise<{
  departmentId: string | null;
  cycle: "PHYSICS" | "CHEMISTRY" | null;
}> {
  const isFirstYearUg =
    student.programType === "UG" &&
    FIRST_YEAR_UG_SEMESTERS.has(student.currentSemester);

  if (isFirstYearUg) {
    const cycle = student.studentSections
      .map((item) => item.section.cycle)
      .find((value) => value === "PHYSICS" || value === "CHEMISTRY");

    if (!cycle) {
      throw new Error(
        "Unable to resolve student cycle for registration window"
      );
    }

    return { departmentId: null, cycle };
  }

  const department = await db.department.findUnique({
    where: { name: student.departmentName },
    select: { id: true },
  });

  if (!department) {
    throw new Error("Student department not found");
  }

  return { departmentId: department.id, cycle: null };
}

async function fetchPriorAttempts(
  studentId: string,
  courseIds?: string[]
): Promise<PriorAttemptRow[]> {
  return db.courseRegistration.findMany({
    where: {
      studentId,
      registrationType: "REGULAR",
      status: "ACTIVE",
      ...(courseIds && courseIds.length > 0
        ? { courseId: { in: courseIds } }
        : {}),
    },
    include: {
      course: {
        select: {
          id: true,
          code: true,
          name: true,
          courseType: true,
          totalCredits: true,
        },
      },
      semester: {
        select: { semesterNumber: true, programType: true },
      },
      academicTerm: {
        select: { type: true, parity: true, year: true },
      },
      examRegistrations: {
        where: { status: { not: "CANCELLED" } },
        select: {
          id: true,
          status: true,
          outcome: true,
          attemptNumber: true,
          registeredAt: true,
        },
      },
    },
    orderBy: { registrationDate: "desc" },
  });
}

/**
 * Pure decision core: turns one prior REGULAR attempt (with its exam
 * history + any in-progress redo) into the re-registration candidate view.
 */
export function buildReRegistrationCandidate(
  prior: PriorAttemptRow,
  hasActiveRedo: boolean
): ReRegistrationCandidateType {
  const latest = deriveLatestOutcome(prior.examRegistrations);
  const latestOutcome = latest?.outcome ?? null;
  const verdict = canReRegister(latestOutcome ?? "PENDING", true);
  const attemptSummary = computeAttemptSummary(
    [prior],
    prior.examRegistrations
  );

  return {
    courseId: prior.course.id,
    code: prior.course.code,
    name: prior.course.name,
    courseType: prior.course
      .courseType as ReRegistrationCandidateType["courseType"],
    totalCredits: prior.course.totalCredits,
    semesterLabel: getSemesterLabel(
      prior.semester.programType,
      prior.semester.semesterNumber
    ),
    academicTermLabel: getTermLabel(
      prior.academicTerm.type,
      prior.academicTerm.year,
      prior.academicTerm.parity
    ),
    attemptCount: attemptSummary.attemptCount,
    nextAttemptNumber: attemptSummary.nextAttemptNumber,
    latestOutcome,
    eligible: verdict.allowed && !hasActiveRedo,
    reasons: [
      ...verdict.reasons,
      ...(hasActiveRedo ? [RE_REGISTRATION_IN_PROGRESS_REASON] : []),
    ],
    warnings: [...attemptSummary.warnings],
  };
}

export class ReRegistrationService {
  static async getEligibleCourses(
    userId: string
  ): Promise<
    BaseResponse<{ isOpen: boolean; candidates: ReRegistrationCandidateType[] }>
  > {
    try {
      const student = await getContext(userId);
      const scope = await resolveScope(student);

      const [priorAttempts, activeRedos, windowState] = await Promise.all([
        fetchPriorAttempts(student.id),
        db.courseRegistration.findMany({
          where: {
            studentId: student.id,
            registrationType: "RE_REGISTRATION",
            status: "ACTIVE",
          },
          select: { courseId: true },
        }),
        isRegistrationWindowOpen(
          {
            registrationType: "RE_REGISTRATION",
            academicTermId: student.academicTermId,
            semesterId: student.semesterId,
            departmentId: scope.departmentId ?? undefined,
            cycle: scope.cycle ?? undefined,
          },
          {}
        ),
      ]);

      const redoCourseIds = new Set(activeRedos.map((redo) => redo.courseId));

      // One candidate view per course (latest attempt wins on duplicates).
      const byCourse = new Map<string, PriorAttemptRow>();
      for (const prior of priorAttempts) {
        if (!byCourse.has(prior.courseId)) {
          byCourse.set(prior.courseId, prior);
        }
      }

      const candidates = [...byCourse.values()].map((prior) =>
        buildReRegistrationCandidate(prior, redoCourseIds.has(prior.courseId))
      );

      return {
        status: "success",
        message: "Re-registration eligibility fetched successfully",
        data: { isOpen: windowState.open, candidates },
      };
    } catch (error) {
      logger.error("Error fetching re-registration eligibility:", { error });
      throw error;
    }
  }

  static async submitReRegistration(
    userId: string,
    request: { courseIds: string[] }
  ): Promise<BaseResponse<SubmitReRegistrationResponseType>> {
    try {
      const student = await getContext(userId);
      const scope = await resolveScope(student);

      const windowState = await isRegistrationWindowOpen(
        {
          registrationType: "RE_REGISTRATION",
          academicTermId: student.academicTermId,
          semesterId: student.semesterId,
          departmentId: scope.departmentId ?? undefined,
          cycle: scope.cycle ?? undefined,
        },
        {}
      );

      if (!windowState.open) {
        throw new Error(
          `Re-registration window is closed (${windowState.reason ?? "NO_WINDOW_CONFIGURED"})`
        );
      }

      const uniqueCourseIds = Array.from(new Set(request.courseIds));

      const [priorAttempts, activeRedos, committedRegistrations] =
        await Promise.all([
          fetchPriorAttempts(student.id, uniqueCourseIds),
          db.courseRegistration.findMany({
            where: {
              studentId: student.id,
              registrationType: "RE_REGISTRATION",
              status: "ACTIVE",
              courseId: { in: uniqueCourseIds },
            },
            select: { courseId: true, course: { select: { code: true } } },
          }),
          db.courseRegistration.findMany({
            where: {
              studentId: student.id,
              academicTermId: student.academicTermId,
              status: "ACTIVE",
              registrationType: {
                in: ["REGULAR", "RE_REGISTRATION"],
              },
            },
            select: { course: { select: { totalCredits: true } } },
          }),
        ]);

      const redoCourseIds = new Set(activeRedos.map((redo) => redo.courseId));

      const byCourse = new Map<string, PriorAttemptRow>();
      for (const prior of priorAttempts) {
        if (!byCourse.has(prior.courseId)) {
          byCourse.set(prior.courseId, prior);
        }
      }

      for (const courseId of uniqueCourseIds) {
        const prior = byCourse.get(courseId);
        if (!prior) {
          throw new Error(
            "Selected courses do not match any of your registered courses"
          );
        }

        const verdict = canReRegister(
          deriveLatestOutcome(prior.examRegistrations)?.outcome ?? "PENDING",
          true
        );
        if (!verdict.allowed) {
          throw new Error(
            `Cannot re-register ${prior.course.code}: ${verdict.reasons.join(", ")}`
          );
        }

        if (redoCourseIds.has(courseId)) {
          throw new Error(
            `A re-registration for ${prior.course.code} is already in progress`
          );
        }
      }

      const committedCredits = committedRegistrations.reduce(
        (sum, registration) => sum + registration.course.totalCredits,
        0
      );
      const requestedCredits = uniqueCourseIds.reduce((sum, courseId) => {
        const prior = byCourse.get(courseId);
        return sum + (prior?.course.totalCredits ?? 0);
      }, 0);

      const creditVerdict = await checkCreditLimit(
        { programType: student.programType },
        {
          totalCredits: committedCredits + requestedCredits,
          supplementaryCredits: 0,
        }
      );

      if (!creditVerdict.verdict.allowed) {
        throw new Error(
          `Credit limit exceeded: ${creditVerdict.verdict.reasons.join(", ")}`
        );
      }

      await db.$transaction(async (tx) => {
        for (const courseId of uniqueCourseIds) {
          const prior = byCourse.get(courseId)!;

          await tx.courseRegistration.update({
            where: { id: prior.id },
            data: { status: "SUPERSEDED" },
          });

          await tx.courseRegistration.create({
            data: {
              studentId: student.id,
              courseId,
              semesterId: prior.semesterId,
              academicTermId: student.academicTermId,
              registrationType: "RE_REGISTRATION",
              sourceRegistrationId: prior.id,
            },
          });
        }
      });

      return {
        status: "success",
        message: "Re-registration submitted successfully",
        data: { count: uniqueCourseIds.length },
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error(
          "A re-registration already exists for one of these courses"
        );
      }
      logger.error("Error submitting re-registration:", { error });
      throw error;
    }
  }

  static async getHistory(
    userId: string
  ): Promise<BaseResponse<ReRegistrationHistoryItemType[]>> {
    try {
      const student = await getContext(userId);

      const registrations = await db.courseRegistration.findMany({
        where: {
          studentId: student.id,
          registrationType: "RE_REGISTRATION",
        },
        include: {
          course: { select: { code: true, name: true } },
          semester: {
            select: { semesterNumber: true, programType: true },
          },
          academicTerm: {
            select: { id: true, type: true, parity: true, year: true },
          },
        },
        orderBy: { registrationDate: "desc" },
      });

      const items: ReRegistrationHistoryItemType[] = registrations.map(
        (registration) => ({
          courseId: registration.courseId,
          code: registration.course.code,
          name: registration.course.name,
          semesterLabel: getSemesterLabel(
            registration.semester.programType,
            registration.semester.semesterNumber
          ),
          academicTermLabel: getTermLabel(
            registration.academicTerm.type,
            registration.academicTerm.year,
            registration.academicTerm.parity
          ),
          status: registration.status,
          registrationDate: registration.registrationDate.toISOString(),
        })
      );

      return {
        status: "success",
        message: "Re-registration history fetched successfully",
        data: items,
      };
    } catch (error) {
      logger.error("Error fetching re-registration history:", { error });
      throw error;
    }
  }
}
