import { isRegistrationWindowOpen } from "@webcampus/api/src/services/shared/academic-rules/academic-rules.service";
import type {
  CourseOutcomeValue,
  ExamRegistrationStatusValue,
  RegistrationStatusValue,
  RegistrationTypeValue,
} from "@webcampus/api/src/services/shared/academic-rules/academic-rules.types";
import { computeAttemptSummary } from "@webcampus/api/src/services/shared/academic-rules/attempt-rules";
import { checkCreditLimit } from "@webcampus/api/src/services/shared/academic-rules/credit-limit.service";
import { deriveLatestOutcome } from "@webcampus/api/src/services/shared/academic-rules/exam-rules";
import { canRegisterSupplementaryCourse } from "@webcampus/api/src/services/shared/academic-rules/registration-rules";
import { logger } from "@webcampus/common/logger";
import { getTermLabel } from "@webcampus/common/term-label";
import { db, Prisma } from "@webcampus/db";
import {
  SubmitSupplementaryResponseType,
  SubmitSupplementaryType,
  SupplementaryCandidateType,
  SupplementaryHistoryItemType,
} from "@webcampus/schemas/student";
import { BaseResponse } from "@webcampus/types/api";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);

interface SupplementaryContext {
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
  semesterId: string;
  status: RegistrationStatusValue;
  registrationDate: Date;
  registrationType: RegistrationTypeValue;
  course: {
    code: string;
    name: string;
    courseType: string;
    totalCredits: number;
  };
  semester: { semesterNumber: number; programType: "UG" | "PG" };
  academicTerm: { type: string; year: string; parity?: "odd" | "even" | null };
  examRegistrations: PriorAttemptExamRow[];
}

export const SUPPLEMENTARY_IN_PROGRESS_REASON =
  "SUPPLEMENTARY_ALREADY_IN_PROGRESS";

export interface SuppOfferingRow {
  courseId: string;
  academicTermId: string;
  academicTerm: {
    id: string;
    type: string;
    year: string;
    parity?: "odd" | "even" | null;
  };
}

/**
 * Keeps only offerings that belong to a SUPPLEMENTARY-type academic term and
 * resolves one offering per course (highest term year wins) so registrations
 * always anchor to the supplementary term the admin configured (DEPENDENCY_MAP
 * Delta #1), never the student's regular current term.
 */
export function pickOfferedSupplementaryOfferings(
  offerings: SuppOfferingRow[]
): Map<string, SuppOfferingRow> {
  const sorted = [...offerings]
    .filter((offering) => offering.academicTerm.type === "supplementary")
    .sort((a, b) => b.academicTerm.year.localeCompare(a.academicTerm.year));

  const byCourse = new Map<string, SuppOfferingRow>();
  for (const offering of sorted) {
    if (!byCourse.has(offering.courseId)) {
      byCourse.set(offering.courseId, offering);
    }
  }

  return byCourse;
}

async function resolveHostSemesterId(
  academicTermId: string,
  programType: "UG" | "PG",
  semesterNumber: number
): Promise<string | null> {
  const hostSemester = await db.semester.findFirst({
    where: {
      academicTermId,
      programType,
      semesterNumber,
    },
    select: { id: true },
  });

  return hostSemester?.id ?? null;
}

function getStudentScopeFilters(student: SupplementaryContext) {
  return student.cycle
    ? { cycle: student.cycle }
    : { departmentId: student.departmentId };
}

async function getContext(userId: string): Promise<SupplementaryContext> {
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
        "Unable to resolve student cycle for supplementary registration"
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
      semesterId: true,
      status: true,
      registrationDate: true,
      registrationType: true,
      course: {
        select: {
          code: true,
          name: true,
          courseType: true,
          totalCredits: true,
        },
      },
      semester: { select: { semesterNumber: true, programType: true } },
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

export function buildSupplementaryCandidate(
  prior: PriorAttemptRow,
  hasActiveSupplementary: boolean,
  offered: boolean
): SupplementaryCandidateType {
  const latest = deriveLatestOutcome(prior.examRegistrations);
  const verdict = canRegisterSupplementaryCourse(latest?.outcome ?? "PENDING");
  const attempts = computeAttemptSummary([prior], prior.examRegistrations);

  const eligible = verdict.allowed && !hasActiveSupplementary && offered;

  return {
    courseId: prior.courseId,
    code: prior.course.code,
    name: prior.course.name,
    courseType: prior.course.courseType,
    totalCredits: prior.course.totalCredits,
    semesterLabel: `Sem ${prior.semester.semesterNumber}`,
    academicTermLabel: getTermLabel(
      prior.academicTerm.type,
      prior.academicTerm.year,
      prior.academicTerm.parity
    ),
    attemptCount: attempts.attemptCount,
    nextAttemptNumber: attempts.nextAttemptNumber,
    latestOutcome: latest?.outcome ?? null,
    offered,
    eligible,
    reasons: [
      ...verdict.reasons,
      ...(hasActiveSupplementary ? [SUPPLEMENTARY_IN_PROGRESS_REASON] : []),
      ...(offered ? [] : ["COURSE_NOT_OFFERED_FOR_SUPPLEMENTARY"]),
    ],
    warnings: attempts.warnings,
  };
}

export class SupplementaryService {
  static async getEligibleCourses(
    userId: string
  ): Promise<
    BaseResponse<{ isOpen: boolean; candidates: SupplementaryCandidateType[] }>
  > {
    try {
      const student = await getContext(userId);

      const priors = await fetchPriorAttempts(student.studentId);
      const priorCourseIds = Array.from(
        new Set(priors.map((prior) => prior.courseId))
      );

      const [activeSupplementary, offeringRows] = await Promise.all([
        db.courseRegistration.findMany({
          where: {
            studentId: student.studentId,
            status: "ACTIVE",
            registrationType: "SUPPLEMENTARY",
          },
          select: { courseId: true },
        }),
        priorCourseIds.length === 0
          ? Promise.resolve([])
          : db.supplementaryCourseOffering.findMany({
              where: { courseId: { in: priorCourseIds } },
              select: {
                courseId: true,
                academicTermId: true,
                academicTerm: {
                  select: { id: true, type: true, parity: true, year: true },
                },
              },
            }),
      ]);

      const offeredByCourse = pickOfferedSupplementaryOfferings(offeringRows);

      const activeCourseIds = new Set(
        activeSupplementary.map((row) => row.courseId)
      );

      const byCourse = new Map<string, PriorAttemptRow>();
      for (const prior of priors) {
        if (!byCourse.has(prior.courseId)) {
          byCourse.set(prior.courseId, prior);
        }
      }

      const windowScopeCache = new Map<string, boolean>();
      let anyWindowOpen = false;

      for (const prior of byCourse.values()) {
        const offering = offeredByCourse.get(prior.courseId);

        if (!offering) {
          continue;
        }

        const scopeKey = `${offering.academicTerm.id}:${prior.semester.programType}:${prior.semester.semesterNumber}`;
        let scopeOpen = windowScopeCache.get(scopeKey);

        if (scopeOpen === undefined) {
          const hostSemesterId = await resolveHostSemesterId(
            offering.academicTerm.id,
            prior.semester.programType,
            prior.semester.semesterNumber
          );

          scopeOpen = hostSemesterId
            ? (
                await isRegistrationWindowOpen({
                  registrationType: "SUPPLEMENTARY",
                  academicTermId: offering.academicTerm.id,
                  semesterId: hostSemesterId,
                  ...getStudentScopeFilters(student),
                })
              ).open
            : false;

          windowScopeCache.set(scopeKey, scopeOpen);
        }

        if (scopeOpen) {
          anyWindowOpen = true;
        }
      }

      const candidates = Array.from(byCourse.values()).map((prior) =>
        buildSupplementaryCandidate(
          prior,
          activeCourseIds.has(prior.courseId),
          offeredByCourse.has(prior.courseId)
        )
      );

      return {
        status: "success",
        message: "Supplementary eligibility fetched successfully",
        data: { isOpen: anyWindowOpen, candidates },
      };
    } catch (error) {
      logger.error("Failed to fetch supplementary eligibility", error);
      throw error;
    }
  }

  static async submitSupplementary(
    userId: string,
    input: SubmitSupplementaryType
  ): Promise<BaseResponse<SubmitSupplementaryResponseType>> {
    try {
      const student = await getContext(userId);

      const uniqueCourseIds = Array.from(new Set(input.courseIds));

      const [priors, activeSupplementary, offeringRows] = await Promise.all([
        fetchPriorAttempts(student.studentId, uniqueCourseIds),
        db.courseRegistration.findMany({
          where: {
            studentId: student.studentId,
            status: "ACTIVE",
            registrationType: "SUPPLEMENTARY",
          },
          select: { courseId: true, course: { select: { code: true } } },
        }),
        db.supplementaryCourseOffering.findMany({
          where: { courseId: { in: uniqueCourseIds } },
          select: {
            courseId: true,
            academicTermId: true,
            academicTerm: {
              select: { id: true, type: true, parity: true, year: true },
            },
          },
        }),
      ]);

      const offeredByCourse = pickOfferedSupplementaryOfferings(offeringRows);

      const byCourse = new Map<string, PriorAttemptRow>();
      for (const prior of priors) {
        if (!byCourse.has(prior.courseId)) {
          byCourse.set(prior.courseId, prior);
        }
      }

      const activeCourseIds = new Set(
        activeSupplementary.map((row) => row.courseId)
      );

      interface SelectedCourse {
        prior: PriorAttemptRow;
        academicTermId: string;
      }

      const selected: SelectedCourse[] = [];
      const windowScopeCache = new Map<string, boolean>();

      for (const courseId of uniqueCourseIds) {
        const prior = byCourse.get(courseId);

        if (!prior) {
          throw new Error(
            "No completed attempt found for one or more selected courses"
          );
        }

        if (activeCourseIds.has(courseId)) {
          throw new Error(
            `A supplementary registration already exists for ${prior.course.code}`
          );
        }

        const offering = offeredByCourse.get(courseId);

        if (!offering) {
          throw new Error(
            `${prior.course.code} is not offered for supplementary`
          );
        }

        const verdict = canRegisterSupplementaryCourse(
          deriveLatestOutcome(prior.examRegistrations)?.outcome ?? "PENDING"
        );

        if (!verdict.allowed) {
          throw new Error(
            `Cannot register supplementary for ${prior.course.code}: ${verdict.reasons.join(", ")}`
          );
        }

        const scopeKey = `${offering.academicTerm.id}:${prior.semester.programType}:${prior.semester.semesterNumber}`;
        let scopeOpen = windowScopeCache.get(scopeKey);

        if (scopeOpen === undefined) {
          const hostSemesterId = await resolveHostSemesterId(
            offering.academicTerm.id,
            prior.semester.programType,
            prior.semester.semesterNumber
          );

          if (!hostSemesterId) {
            throw new Error(
              "Supplementary registration window is closed (NO_WINDOW_CONFIGURED)"
            );
          }

          const state = await isRegistrationWindowOpen({
            registrationType: "SUPPLEMENTARY",
            academicTermId: offering.academicTerm.id,
            semesterId: hostSemesterId,
            ...getStudentScopeFilters(student),
          });

          if (!state.open) {
            throw new Error(
              `Supplementary registration window is closed (${state.reason ?? "unavailable"})`
            );
          }

          scopeOpen = true;
          windowScopeCache.set(scopeKey, scopeOpen);
        }

        selected.push({ prior, academicTermId: offering.academicTermId });
      }

      const supplementaryTermIds = Array.from(
        new Set(selected.map((course) => course.academicTermId))
      );

      const committedSupplementaryRows = await db.courseRegistration.findMany({
        where: {
          studentId: student.studentId,
          status: "ACTIVE",
          registrationType: "SUPPLEMENTARY",
          academicTermId: { in: supplementaryTermIds },
        },
        select: { course: { select: { totalCredits: true } } },
      });

      const committedSupplementaryCredits = committedSupplementaryRows.reduce(
        (sum, row) => sum + row.course.totalCredits,
        0
      );
      const requestedCredits = selected.reduce(
        (sum, course) => sum + course.prior.course.totalCredits,
        0
      );
      const totalSupplementaryCredits =
        committedSupplementaryCredits + requestedCredits;

      const creditVerdict = await checkCreditLimit(
        { programType: student.programType },
        {
          totalCredits: 0,
          supplementaryCredits: totalSupplementaryCredits,
        }
      );

      if (!creditVerdict.verdict.allowed) {
        throw new Error(
          `Credit limit exceeded: ${creditVerdict.verdict.reasons.join(", ")}`
        );
      }

      await db.$transaction(async (tx) => {
        for (const course of selected) {
          await tx.courseRegistration.update({
            where: { id: course.prior.id },
            data: { status: "SUPERSEDED" },
          });

          await tx.courseRegistration.create({
            data: {
              studentId: student.studentId,
              courseId: course.prior.courseId,
              semesterId: course.prior.semesterId,
              academicTermId: course.academicTermId,
              registrationType: "SUPPLEMENTARY",
              sourceRegistrationId: course.prior.id,
            },
          });
        }
      });

      logger.info("Supplementary registrations submitted", {
        studentId: student.studentId,
        count: selected.length,
      });

      return {
        status: "success",
        message: "Supplementary registrations submitted successfully",
        data: { count: selected.length },
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error(
          "A supplementary registration already exists for one of these courses"
        );
      }
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Failed to submit supplementary registrations", error);
      throw new Error("Failed to submit supplementary registrations");
    }
  }

  static async getHistory(
    userId: string
  ): Promise<BaseResponse<SupplementaryHistoryItemType[]>> {
    try {
      const student = await getContext(userId);

      const registrations = await db.courseRegistration.findMany({
        where: {
          studentId: student.studentId,
          registrationType: "SUPPLEMENTARY",
        },
        orderBy: { registrationDate: "desc" },
        select: {
          courseId: true,
          status: true,
          registrationDate: true,
          course: { select: { code: true, name: true } },
          semester: { select: { semesterNumber: true } },
          academicTerm: {
            select: { id: true, type: true, parity: true, year: true },
          },
        },
      });

      return {
        status: "success",
        message: "Supplementary history fetched successfully",
        data: registrations.map((registration) => ({
          courseId: registration.courseId,
          code: registration.course.code,
          name: registration.course.name,
          semesterLabel: `Sem ${registration.semester.semesterNumber}`,
          academicTermLabel: getTermLabel(
            registration.academicTerm.type,
            registration.academicTerm.year,
            registration.academicTerm.parity
          ),
          status: registration.status,
          registrationDate: registration.registrationDate.toISOString(),
        })),
      };
    } catch (error) {
      logger.error("Failed to fetch supplementary history", error);
      throw error;
    }
  }
}
