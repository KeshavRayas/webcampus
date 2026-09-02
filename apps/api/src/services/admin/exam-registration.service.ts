import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { GetExamRegistrationsQueryType } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";

export interface ExamRegistrationListItem {
  id: string;
  usn: string;
  studentName: string;
  courseId: string;
  code: string;
  courseName: string;
  academicTermId: string;
  examType: string;
  attemptNumber: number;
  status: string;
  outcome: string | null;
  seeMarks: number | null;
  maxSeeMarks: number | null;
  eligibleAtRegistration: boolean;
  registeredAt: string;
}

export class ExamRegistrationAdminService {
  static async getRegistrations(query: GetExamRegistrationsQueryType): Promise<
    BaseResponse<{
      data: ExamRegistrationListItem[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>
  > {
    try {
      const term = await db.academicTerm.findUnique({
        where: { id: query.academicTermId },
        select: { id: true },
      });

      if (!term) {
        throw new Error("Academic term not found");
      }

      const where = {
        academicTermId: query.academicTermId,
        ...(query.courseId ? { courseId: query.courseId } : {}),
        ...(query.examType ? { examType: query.examType } : {}),
        ...(query.status ? { status: query.status } : {}),
      };

      const [total, rows] = await Promise.all([
        db.examRegistration.count({ where }),
        db.examRegistration.findMany({
          where,
          orderBy: { registeredAt: "desc" },
          skip: (Number(query.page ?? 1) - 1) * Number(query.pageSize ?? 20),
          take: Number(query.pageSize ?? 20),
          select: {
            id: true,
            courseId: true,
            academicTermId: true,
            examType: true,
            attemptNumber: true,
            status: true,
            outcome: true,
            seeMarks: true,
            maxSeeMarks: true,
            eligibleAtRegistration: true,
            registeredAt: true,
            course: { select: { code: true, name: true } },
            student: {
              select: { usn: true, user: { select: { name: true } } },
            },
          },
        }),
      ]);

      return {
        status: "success",
        message: "Exam registrations fetched successfully",
        data: {
          data: rows.map((row) => ({
            id: row.id,
            usn: row.student.usn,
            studentName: row.student.user.name,
            courseId: row.courseId,
            code: row.course.code,
            courseName: row.course.name,
            academicTermId: row.academicTermId,
            examType: row.examType,
            attemptNumber: row.attemptNumber,
            status: row.status,
            outcome: row.outcome,
            seeMarks: row.seeMarks,
            maxSeeMarks: row.maxSeeMarks,
            eligibleAtRegistration: row.eligibleAtRegistration,
            registeredAt: row.registeredAt.toISOString(),
          })),
          total,
          page: query.page ?? 1,
          pageSize: query.pageSize ?? 20,
          totalPages: Math.max(1, Math.ceil(total / (query.pageSize ?? 20))),
        },
      };
    } catch (error) {
      logger.error("Failed to fetch exam registrations", error);
      throw error;
    }
  }
}
