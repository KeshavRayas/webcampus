import { buildAggregationResultsForStudents } from "@webcampus/api/src/services/shared/assessment-aggregation.loader";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import type { BaseResponse } from "@webcampus/types/api";

export class StudentMarksService {
  static async getMarksSummary(
    userId: string,
    semesterId?: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const student = await db.student.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!student) {
        throw new Error("Student profile not found");
      }

      const registrations = await db.courseRegistration.findMany({
        where: {
          studentId: student.id,
          ...(semesterId && { semesterId }),
        },
        include: {
          course: {
            select: {
              id: true,
              code: true,
              name: true,
              semesterId: true,
            },
          },
        },
      });

      const courseSummaries = [];

      for (const registration of registrations) {
        const courseId = registration.courseId;
        const aggregationResults = await buildAggregationResultsForStudents(
          courseId,
          [student.id]
        );
        const result = aggregationResults.get(student.id);

        const mark = await db.mark.findUnique({
          where: {
            studentId_courseId: {
              studentId: student.id,
              courseId,
            },
          },
          select: {
            cieTotal: true,
            status: true,
          },
        });

        const assessments = await db.assessmentTemplate.findMany({
          where: {
            courseId,
            semesterId: registration.course.semesterId,
          },
          select: {
            id: true,
            title: true,
            componentType: true,
            totalMarks: true,
            sequence: true,
          },
          orderBy: [{ componentType: "asc" }, { sequence: "asc" }],
        });

        const studentAssessments = await db.studentAssessment.findMany({
          where: {
            studentId: student.id,
            courseId,
          },
          select: {
            assessmentId: true,
            totalMarks: true,
            status: true,
          },
        });

        const scoreMap = new Map(
          studentAssessments.map((assessment) => [
            assessment.assessmentId,
            assessment,
          ])
        );

        courseSummaries.push({
          courseId,
          courseCode: registration.course.code,
          courseName: registration.course.name,
          assessments: assessments.map((assessment) => ({
            id: assessment.id,
            title: assessment.title,
            componentType: assessment.componentType,
            maxMarks: assessment.totalMarks,
            totalMarks: scoreMap.get(assessment.id)?.totalMarks ?? null,
            status: scoreMap.get(assessment.id)?.status ?? null,
          })),
          components: result
            ? {
                theory: result.components.theory,
                lab: result.components.lab,
                aat: result.components.aat,
              }
            : null,
          total: result?.cieTotal ?? mark?.cieTotal ?? null,
          status: result?.status ?? mark?.status ?? "NOT_ELIGIBLE",
        });
      }

      return {
        status: "success",
        message: "Marks summary fetched successfully",
        data: courseSummaries,
      };
    } catch (error) {
      logger.error("Error fetching student marks summary", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch marks summary");
    }
  }
}
