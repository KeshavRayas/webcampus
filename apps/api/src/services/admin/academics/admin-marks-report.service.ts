import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { BaseResponse } from "@webcampus/types/api";
import { assertBatchBelongsToCourse } from "../../shared/batch-managed";
import { isBatchManagedCourse } from "../../shared/course-kind";

export class AdminMarksReportService {
  static async getMarksReport(
    courseId: string,
    sectionId?: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const course = await db.course.findUnique({
        where: { id: courseId },
        include: {
          semester: {
            include: {
              academicTerm: true,
            },
          },
        },
      });

      if (!course) {
        throw new Error("Course not found");
      }

      const assessments = await db.assessmentTemplate.findMany({
        where: { courseId },
        orderBy: { title: "asc" },
      });

      const registrations = await db.courseRegistration.findMany({
        where: {
          courseId,
          semesterId: course.semesterId,
          ...(sectionId && !isBatchManagedCourse(course.courseType)
            ? {
                student: {
                  studentSections: {
                    some: { sectionId },
                  },
                },
              }
            : {}),
        },
        include: {
          student: {
            select: {
              id: true,
              usn: true,
              user: {
                select: { name: true },
              },
            },
          },
        },
      });

      let studentIds: string[] = [];
      let roster: { id: string; usn: string; user: { name: string } }[] = [];

      if (isBatchManagedCourse(course.courseType) && sectionId) {
        await assertBatchBelongsToCourse(courseId, sectionId);
        const batchStudents = await db.electiveStudentAssignment.findMany({
          where: { courseId, electiveBatchId: sectionId },
          include: {
            student: {
              select: {
                id: true,
                usn: true,
                user: { select: { name: true } },
              },
            },
          },
        });
        roster = batchStudents.map((bs) => bs.student);
      } else {
        roster = registrations.map((r) => r.student);
      }
      studentIds = roster.map((s) => s.id);

      const studentAssessments = await db.studentAssessment.findMany({
        where: {
          studentId: { in: studentIds },
          courseId,
        },
      });

      const marksMap = new Map<
        string,
        { cieTotal: number | null; status: string }
      >(
        studentIds.map((id) => [id, { cieTotal: null, status: "NOT_ELIGIBLE" }])
      );

      const markRecords = await db.mark.findMany({
        where: {
          studentId: { in: studentIds },
          courseId,
        },
      });

      for (const mark of markRecords) {
        marksMap.set(mark.studentId, {
          cieTotal: mark.cieTotal,
          status: mark.status,
        });
      }

      const assessmentMap = new Map(
        studentAssessments.map((sa) => [
          `${sa.studentId}_${sa.assessmentId}`,
          sa,
        ])
      );

      const students = roster.map((student) => {
        const markInfo = marksMap.get(student.id) ?? {
          cieTotal: null,
          status: "NOT_ELIGIBLE",
        };

        const assessmentScores = assessments.map((a) => {
          const sa = assessmentMap.get(`${student.id}_${a.id}`);
          return {
            assessmentId: a.id,
            assessmentTitle: a.title,
            totalMarks: sa?.totalMarks ?? null,
            maxMarks: a.totalMarks,
          };
        });

        return {
          usn: student.usn,
          name: student.user.name,
          assessments: assessmentScores,
          cieTotal: markInfo.cieTotal,
          status: markInfo.status,
        };
      });

      const result = {
        course: {
          id: course.id,
          code: course.code,
          name: course.name,
          cieMinMarks: (course.cieEligibility / 100) * course.cieMaxMarks,
          cieEligibilityPercent: course.cieEligibility,
        },
        assessments: assessments.map((a) => ({
          id: a.id,
          title: a.title,
          totalMarks: a.totalMarks,
        })),
        semester: {
          id: course.semester.id,
          semesterNumber: course.semester.semesterNumber,
          academicTerm: {
            id: course.semester.academicTerm.id,
            type: course.semester.academicTerm.type,
            year: course.semester.academicTerm.year,
          },
        },
        students,
      };

      return {
        status: "success",
        message: "Marks report retrieved successfully",
        data: result,
      };
    } catch (error) {
      logger.error("Error fetching marks report", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch marks report");
    }
  }
}
