import { db } from "@webcampus/db";
import {
  buildComponentInputs,
  toCourseAggregationConfig,
  validateCourseTemplateLayout,
  type StudentAssessmentSource,
} from "./assessment-aggregation.mapper";
import { computeAggregation } from "./assessment-aggregation.service";
import type { AggregationResult } from "./assessment-aggregation.types";

export async function buildAggregationResultsForStudents(
  courseId: string,
  studentIds: string[],
  tx?: Prisma.TransactionClient
): Promise<Map<string, AggregationResult>> {
  const prisma = tx ?? db;
  const results = new Map<string, AggregationResult>();

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

  const templates = await db.assessmentTemplate.findMany({
    where: { courseId },
    select: {
      id: true,
      componentType: true,
      sequence: true,
      totalMarks: true,
    },
    orderBy: [{ componentType: "asc" }, { sequence: "asc" }],
  });

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

  const studentAssessments = await db.studentAssessment.findMany({
    where: {
      courseId,
      studentId: { in: studentIds },
    },
    select: {
      studentId: true,
      assessmentId: true,
      totalMarks: true,
      status: true,
    },
  });

  const assessmentsByStudent = new Map<string, StudentAssessmentSource[]>();
  for (const row of studentAssessments) {
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
