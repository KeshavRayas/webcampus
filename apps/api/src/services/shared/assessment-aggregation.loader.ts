import { db, Prisma } from "@webcampus/db";
import {
  buildComponentInputs,
  toCourseAggregationConfig,
  validateCourseTemplateLayout,
  type StudentAssessmentSource,
} from "./assessment-aggregation.mapper";
import { computeAggregation } from "./assessment-aggregation.service";
import type { AggregationResult } from "./assessment-aggregation.types";

export type AggregationLoaderOptions = {
  academicTermId?: string | null;
  semesterId?: string | null;
  preferredRegistrationByStudent?: ReadonlyMap<string, string>;
};

export async function buildAggregationResultsForStudents(
  courseId: string,
  studentIds: string[],
  tx?: Prisma.TransactionClient,
  options?: AggregationLoaderOptions
): Promise<Map<string, AggregationResult>> {
  const prisma = tx ?? db;
  const results = new Map<string, AggregationResult>();
  const academicTermId = options?.academicTermId;
  const semesterId = options?.semesterId;
  const hasAnchor = Boolean(academicTermId || semesterId);

  if (studentIds.length === 0) {
    return results;
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      cieMaxMarks: true,
      cieEligibility: true,
      cieEligibilityPolicy: true,
      theoryMaxExams: true,
      theoryMinExams: true,
      theoryExamMaxMarks: true,
      theoryCieContribution: true,
      theoryEligibility: true,
      labMaxMarks: true,
      labEligibility: true,
      aatMaxMarks: true,
      aatEligibility: true,
    },
  });

  if (!course) {
    throw new Error(`Course ${courseId} not found`);
  }

  const templates = await prisma.assessmentTemplate.findMany({
    where: {
      courseId,
      ...(semesterId ? { semesterId } : {}),
      ...(academicTermId && !semesterId
        ? {
            semesterId: {
              in: (
                await prisma.semester.findMany({
                  where: { academicTermId },
                  select: { id: true },
                })
              ).map((s) => s.id),
            },
          }
        : {}),
    },
    select: {
      id: true,
      componentType: true,
      sequence: true,
      totalMarks: true,
    },
    orderBy: [{ componentType: "asc" }, { sequence: "asc" }],
  });

  const templateIds = templates.map((t) => t.id);

  const untypedTemplates = templates.filter((t) => t.componentType === null);
  if (untypedTemplates.length > 0) {
    throw new Error(
      `Course ${courseId} has ${untypedTemplates.length} assessment template(s) without componentType — run backfill before aggregation`
    );
  }

  const theoryTemplateCount = templates.filter(
    (t) => t.componentType === "THEORY"
  ).length;

  const courseConfig = toCourseAggregationConfig(course, theoryTemplateCount);
  const layoutWarnings = validateCourseTemplateLayout(course, templates);

  const studentAssessments = await prisma.studentAssessment.findMany({
    where: {
      courseId,
      studentId: { in: studentIds },
      ...(hasAnchor ? { assessmentId: { in: templateIds } } : {}),
    },
    select: {
      id: true,
      studentId: true,
      assessmentId: true,
      totalMarks: true,
      status: true,
      courseRegistrationId: true,
    },
  });

  // One row per (student, assessment) feeds aggregation: rows pinned to the
  // student's current attempt win, then any pinned row beats a legacy null
  // row; newest id breaks remaining ties deterministically.
  const preferredAssessments = preferAttemptScopedAssessments(
    studentAssessments,
    options?.preferredRegistrationByStudent
  );

  const assessmentsByStudent = new Map<string, StudentAssessmentSource[]>();
  for (const row of preferredAssessments) {
    const list = assessmentsByStudent.get(row.studentId) ?? [];
    list.push({
      assessmentId: row.assessmentId,
      totalMarks: row.totalMarks,
      status: row.status,
    });
    assessmentsByStudent.set(row.studentId, list);
  }

  for (const studentId of studentIds) {
    const studentRows = assessmentsByStudent.get(studentId) ?? [];
    const components = buildComponentInputs(course, templates, studentRows);
    const result = computeAggregation(components, courseConfig, studentId);
    result.warnings = [...layoutWarnings, ...result.warnings];
    results.set(studentId, result);
  }

  return results;
}

type AssessmentRowForPreference = {
  id: string;
  studentId: string;
  assessmentId: string;
  totalMarks: number;
  status: string;
  courseRegistrationId: string | null;
};

export function preferAttemptScopedAssessments<
  T extends AssessmentRowForPreference,
>(
  rows: readonly T[],
  preferredRegistrationByStudent?: ReadonlyMap<string, string>
): T[] {
  const bestByStudentAssessment = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.studentId}_${row.assessmentId}`;
    const incumbent = bestByStudentAssessment.get(key);
    if (
      !incumbent ||
      preferAssessmentRow(
        row,
        incumbent,
        preferredRegistrationByStudent?.get(row.studentId) ?? null
      )
    ) {
      bestByStudentAssessment.set(key, row);
    }
  }
  return [...bestByStudentAssessment.values()];
}

function preferAssessmentRow(
  candidate: AssessmentRowForPreference,
  incumbent: AssessmentRowForPreference,
  preferredRegistrationId: string | null
): boolean {
  if (preferredRegistrationId) {
    const candidatePreferred =
      candidate.courseRegistrationId === preferredRegistrationId;
    const incumbentPreferred =
      incumbent.courseRegistrationId === preferredRegistrationId;
    if (candidatePreferred !== incumbentPreferred) {
      return candidatePreferred;
    }
  }
  const candidatePinned = candidate.courseRegistrationId !== null;
  const incumbentPinned = incumbent.courseRegistrationId !== null;
  if (candidatePinned !== incumbentPinned) {
    return candidatePinned;
  }
  return candidate.id > incumbent.id;
}
