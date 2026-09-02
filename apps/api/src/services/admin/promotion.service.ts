import { SectionService } from "@webcampus/api/src/services/department/section.service";
import type { CourseOutcomeValue } from "@webcampus/api/src/services/shared/academic-rules/academic-rules.types";
import { deriveLatestOutcome } from "@webcampus/api/src/services/shared/academic-rules/exam-rules";
import { logChanges } from "@webcampus/api/src/services/shared/audit.service";
import { logger } from "@webcampus/common/logger";
import { getTermLabel } from "@webcampus/common/term-label";
import { db, Prisma } from "@webcampus/db";
import type {
  PromoteStudentsType,
  PromotionCandidatesQueryType,
  PromotionHistoryQueryType,
} from "@webcampus/schemas/admin";
import type { BaseResponse } from "@webcampus/types/api";

type Tx = Prisma.TransactionClient;

const UNRESOLVED_OUTCOMES: readonly CourseOutcomeValue[] = [
  "F",
  "NE",
  "W",
  "X",
  "I",
];

export interface OutstandingBacklog {
  courseId: string;
  courseCode: string;
  courseName: string;
  outcome: CourseOutcomeValue;
}

export interface BacklogSummaryByStudent {
  [studentId: string]: OutstandingBacklog[];
}

export interface PromotionCandidateItem {
  studentId: string;
  usn: string;
  name: string;
  departmentName: string;
  currentSemester: number;
}

export interface PromotionNonEligibleItem extends PromotionCandidateItem {
  reasons: string[];
  outstandingBacklogs: OutstandingBacklog[];
}

export interface PromotionCandidatesData {
  fromSemester: {
    id: string;
    semesterNumber: number;
    programType: string;
    academicTermLabel: string;
  };
  toSemester: {
    id: string;
    semesterNumber: number;
    programType: string;
    academicTermLabel: string;
  };
  eligible: PromotionCandidateItem[];
  nonEligible: PromotionNonEligibleItem[];
}

interface SemesterWithTerm {
  id: string;
  semesterNumber: number;
  programType: "UG" | "PG";
  academicTermId: string;
  academicTerm: {
    id: string;
    type: string;
    year: string;
    parity?: "odd" | "even" | null;
  };
}

export async function loadSemesters(
  fromSemesterId: string,
  toSemesterId: string,
  client: Tx | typeof db = db
): Promise<{ from: SemesterWithTerm; to: SemesterWithTerm }> {
  const [fromRaw, toRaw] = await Promise.all([
    client.semester.findUnique({
      where: { id: fromSemesterId },
      select: {
        id: true,
        semesterNumber: true,
        programType: true,
        academicTermId: true,
        academicTerm: {
          select: { id: true, type: true, parity: true, year: true },
        },
      },
    }),
    client.semester.findUnique({
      where: { id: toSemesterId },
      select: {
        id: true,
        semesterNumber: true,
        programType: true,
        academicTermId: true,
        academicTerm: {
          select: { id: true, type: true, parity: true, year: true },
        },
      },
    }),
  ]);

  if (!fromRaw || !toRaw)
    throw new Error("Source or target semester not found");

  const from = fromRaw as unknown as SemesterWithTerm;
  const to = toRaw as unknown as SemesterWithTerm;

  if (to.semesterNumber !== from.semesterNumber + 1)
    throw new Error(
      "Target semester must be exactly one semester ahead of the source"
    );

  if (from.programType !== to.programType)
    throw new Error(
      "Source and target semester must share the same program type"
    );

  return { from, to };
}

export function computeOutstandingBacklogs(
  examRegistrations: {
    studentId: string;
    courseId: string;
    status: string;
    outcome: string;
    registeredAt: Date;
  }[]
): {
  backlogsByStudent: BacklogSummaryByStudent;
  courseIds: Set<string>;
} {
  const grouped = new Map<
    string,
    Map<string, Parameters<typeof deriveLatestOutcome>[0]>
  >();
  const courseIds = new Set<string>();

  for (const reg of examRegistrations) {
    const studentMap = grouped.get(reg.studentId) ?? new Map();
    const courseRegs = studentMap.get(reg.courseId) ?? [];
    courseRegs.push({
      status: reg.status as never,
      outcome: reg.outcome as never,
      registeredAt: reg.registeredAt,
    });
    studentMap.set(reg.courseId, courseRegs);
    grouped.set(reg.studentId, studentMap);
    courseIds.add(reg.courseId);
  }

  const backlogsByStudent: BacklogSummaryByStudent = {};
  for (const [studentId, courseMap] of grouped) {
    const backlogs: OutstandingBacklog[] = [];
    for (const [courseId, regs] of courseMap) {
      const latest = deriveLatestOutcome(regs);
      if (
        latest.outcome !== null &&
        UNRESOLVED_OUTCOMES.includes(latest.outcome)
      ) {
        backlogs.push({
          courseId,
          courseCode: "",
          courseName: "",
          outcome: latest.outcome,
        });
      }
    }
    if (backlogs.length > 0) backlogsByStudent[studentId] = backlogs;
  }

  return { backlogsByStudent, courseIds };
}

export async function decorateBacklogCourses(
  backlogsByStudent: BacklogSummaryByStudent,
  client: Tx | typeof db = db
): Promise<BacklogSummaryByStudent> {
  const courseIds = new Set<string>();
  for (const backlogs of Object.values(backlogsByStudent)) {
    for (const backlog of backlogs) courseIds.add(backlog.courseId);
  }
  if (courseIds.size === 0) return backlogsByStudent;

  const courses = await client.course.findMany({
    where: { id: { in: Array.from(courseIds) } },
    select: { id: true, code: true, name: true },
  });
  const courseById = new Map(courses.map((course) => [course.id, course]));

  const decorated: BacklogSummaryByStudent = {};
  for (const [studentId, backlogs] of Object.entries(backlogsByStudent)) {
    decorated[studentId] = backlogs.map((backlog) => ({
      ...backlog,
      courseCode: courseById.get(backlog.courseId)?.code ?? "",
      courseName: courseById.get(backlog.courseId)?.name ?? "",
    }));
  }
  return decorated;
}

export function partitionCandidates(
  candidates: PromotionCandidateItem[],
  backlogsByStudent: BacklogSummaryByStudent,
  alreadyPromotedIds: Set<string>
): {
  eligible: PromotionCandidateItem[];
  nonEligible: PromotionNonEligibleItem[];
} {
  const eligible: PromotionCandidateItem[] = [];
  const nonEligible: PromotionNonEligibleItem[] = [];

  for (const candidate of candidates) {
    const backlogs = backlogsByStudent[candidate.studentId] ?? [];
    const reasons: string[] = [];

    if (backlogs.length > 0) reasons.push("HAS_OUTSTANDING_BACKLOGS");
    if (alreadyPromotedIds.has(candidate.studentId))
      reasons.push("ALREADY_PROMOTED_TO_TARGET_TERM");

    if (reasons.length > 0) {
      nonEligible.push({
        ...candidate,
        reasons,
        outstandingBacklogs: backlogs,
      });
    } else {
      eligible.push(candidate);
    }
  }

  return { eligible, nonEligible };
}

export function buildPromotionUpdateData(to: SemesterWithTerm): {
  currentSemester: number;
  semesterNumber: number;
  semesterId: string;
  academicTermId: string;
  academicTermLabel: string;
  academicTermType: "even" | "odd" | "supplementary";
  academicTermYear: string;
} {
  return {
    currentSemester: to.semesterNumber,
    semesterNumber: to.semesterNumber,
    semesterId: to.id,
    academicTermId: to.academicTerm.id,
    academicTermLabel: getTermLabel(
      to.academicTerm.type,
      to.academicTerm.year,
      to.academicTerm.parity
    ),
    academicTermType: to.academicTerm.type as "even" | "odd" | "supplementary",
    academicTermYear: to.academicTerm.year,
  };
}

export class PromotionService {
  static async getCandidates(
    query: PromotionCandidatesQueryType
  ): Promise<BaseResponse<PromotionCandidatesData>> {
    try {
      const { from, to } = await loadSemesters(
        query.fromSemesterId,
        query.toSemesterId
      );

      const students = await db.student.findMany({
        where: { semesterId: query.fromSemesterId },
        select: {
          id: true,
          usn: true,
          currentSemester: true,
          departmentName: true,
          user: { select: { name: true } },
        },
        orderBy: { usn: "asc" },
      });

      const studentIds = students.map((student) => student.id);

      const examRegistrations =
        studentIds.length > 0
          ? await db.examRegistration.findMany({
              where: {
                studentId: { in: studentIds },
                status: { not: "CANCELLED" },
              },
              select: {
                studentId: true,
                courseId: true,
                status: true,
                outcome: true,
                registeredAt: true,
              },
            })
          : [];

      const { backlogsByStudent } =
        computeOutstandingBacklogs(examRegistrations);
      const decorated = await decorateBacklogCourses(backlogsByStudent);

      const existingPromotions =
        studentIds.length > 0
          ? await db.studentPromotion.findMany({
              where: {
                studentId: { in: studentIds },
                academicTermId: to.academicTermId,
                fromSemesterNumber: from.semesterNumber,
              },
              select: { studentId: true },
            })
          : [];

      const alreadyPromotedIds = new Set(
        existingPromotions.map((promotion) => promotion.studentId)
      );

      const candidates: PromotionCandidateItem[] = students.map((student) => ({
        studentId: student.id,
        usn: student.usn,
        name: student.user.name,
        departmentName: student.departmentName,
        currentSemester: student.currentSemester,
      }));

      const { eligible, nonEligible } = partitionCandidates(
        candidates,
        decorated,
        alreadyPromotedIds
      );

      return {
        status: "success",
        message: "Promotion candidates fetched",
        data: {
          fromSemester: {
            id: from.id,
            semesterNumber: from.semesterNumber,
            programType: from.programType,
            academicTermLabel: getTermLabel(
              from.academicTerm.type,
              from.academicTerm.year,
              from.academicTerm.parity
            ),
          },
          toSemester: {
            id: to.id,
            semesterNumber: to.semesterNumber,
            programType: to.programType,
            academicTermLabel: getTermLabel(
              to.academicTerm.type,
              to.academicTerm.year,
              to.academicTerm.parity
            ),
          },
          eligible,
          nonEligible,
        },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      logger.error("Error fetching promotion candidates:", { error });
      throw new Error("Failed to fetch promotion candidates");
    }
  }

  static async promoteStudents(
    input: PromoteStudentsType,
    adminUserId: string
  ): Promise<
    BaseResponse<{
      promotedCount: number;
      studentIds: string[];
      sectionsPromoted: boolean;
    }>
  > {
    try {
      const { from, to } = await loadSemesters(
        input.fromSemesterId,
        input.toSemesterId
      );

      const students = await db.student.findMany({
        where: { id: { in: input.studentIds } },
        select: {
          id: true,
          usn: true,
          currentSemester: true,
          semesterId: true,
        },
      });

      if (students.length !== input.studentIds.length) {
        const foundIds = new Set(students.map((student) => student.id));
        const missing = input.studentIds.filter((id) => !foundIds.has(id));
        throw new Error(`Students not found: ${missing.join(", ")}`);
      }

      const mismatches = students.filter(
        (student) =>
          student.semesterId !== input.fromSemesterId ||
          student.currentSemester !== from.semesterNumber
      );
      if (mismatches.length > 0) {
        throw new Error(
          `Students are not enrolled in the source semester: ${mismatches
            .map((student) => student.usn)
            .join(", ")}`
        );
      }

      const duplicates = await db.studentPromotion.findMany({
        where: {
          studentId: { in: input.studentIds },
          academicTermId: to.academicTermId,
          fromSemesterNumber: from.semesterNumber,
        },
        select: { studentId: true },
      });
      if (duplicates.length > 0) {
        const duplicateSet = await db.student.findMany({
          where: { id: { in: duplicates.map((d) => d.studentId) } },
          select: { usn: true },
        });
        throw new Error(
          `Already promoted this term: ${duplicateSet
            .map((student) => student.usn)
            .join(", ")}`
        );
      }

      const updateData = buildPromotionUpdateData(to);
      const shouldPromoteSections =
        input.promoteFirstYearSections &&
        from.semesterNumber === 1 &&
        to.semesterNumber === 2;

      const result = await db.$transaction(async (tx) => {
        for (const student of students) {
          const before = await tx.student.findUniqueOrThrow({
            where: { id: student.id },
            select: {
              currentSemester: true,
              semesterId: true,
              academicTermId: true,
            },
          });

          await tx.student.update({
            where: { id: student.id },
            data: updateData,
          });

          const promotion = await tx.studentPromotion.create({
            data: {
              studentId: student.id,
              fromSemesterNumber: from.semesterNumber,
              toSemesterNumber: to.semesterNumber,
              fromSemesterId: from.id,
              toSemesterId: to.id,
              academicTermId: to.academicTermId,
              promotedById: adminUserId,
              notes: input.notes ?? null,
            },
          });

          await logChanges(
            {
              entityType: "PROMOTION",
              entityId: promotion.id,
              action: "PROMOTE_STUDENT",
              adminUserId,
              reason: input.notes,
              changes: [
                {
                  fieldName: "currentSemester",
                  oldValue: before.currentSemester,
                  newValue: updateData.currentSemester,
                },
                {
                  fieldName: "semesterId",
                  oldValue: before.semesterId,
                  newValue: updateData.semesterId,
                },
                {
                  fieldName: "academicTermId",
                  oldValue: before.academicTermId,
                  newValue: updateData.academicTermId,
                },
              ],
            },
            tx
          );
        }

        if (shouldPromoteSections) {
          await SectionService.promoteFirstYearSections(
            from.id,
            to.id,
            input.academicYear!,
            tx
          );
        }

        return { promotedCount: students.length };
      });

      if (shouldPromoteSections) {
        await (
          await import("@webcampus/common/cache")
        ).invalidatePrefix("cache:section:");
      }

      return {
        status: "success",
        message: `Promoted ${result.promotedCount} student(s) from Semester ${from.semesterNumber} to Semester ${to.semesterNumber}`,
        data: {
          promotedCount: result.promotedCount,
          studentIds: input.studentIds,
          sectionsPromoted: Boolean(shouldPromoteSections),
        },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      logger.error("Error promoting students:", { error });
      throw new Error("Failed to promote students");
    }
  }

  static async getHistory(query: PromotionHistoryQueryType): Promise<
    BaseResponse<{
      data: unknown[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>
  > {
    try {
      const where: Prisma.StudentPromotionWhereInput = {};
      if (query.academicTermId) where.academicTermId = query.academicTermId;
      if (query.studentId) where.studentId = query.studentId;

      const [rows, total] = await Promise.all([
        db.studentPromotion.findMany({
          where,
          orderBy: { promotedAt: "desc" },
          skip: (Number(query.page) - 1) * Number(query.pageSize),
          take: Number(query.pageSize),
          select: {
            id: true,
            fromSemesterNumber: true,
            toSemesterNumber: true,
            notes: true,
            promotedAt: true,
            student: {
              select: { id: true, usn: true, user: { select: { name: true } } },
            },
            promotedBy: { select: { name: true } },
            academicTerm: {
              select: { id: true, type: true, parity: true, year: true },
            },
          },
        }),
        db.studentPromotion.count({ where }),
      ]);

      return {
        status: "success",
        message: "Promotion history fetched",
        data: {
          data: rows,
          total,
          page: query.page,
          pageSize: query.pageSize,
          totalPages: Math.ceil(total / query.pageSize),
        },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      logger.error("Error fetching promotion history:", { error });
      throw new Error("Failed to fetch promotion history");
    }
  }
}
