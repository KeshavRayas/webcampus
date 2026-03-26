import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import {
  AdminStudentResponseType,
  GetAdminStudentsQueryType,
} from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";

export class AdminStudentService {
  /**
   * Fetches all students globally (no department scoping).
   * Used by system admins to view the entire college roster.
   */
  static async getAll(
    query: GetAdminStudentsQueryType
  ): Promise<BaseResponse<AdminStudentResponseType[]>> {
    try {
      const where: Prisma.StudentWhereInput = {};

      if (query.usn) {
        where.usn = { contains: query.usn, mode: "insensitive" };
      }

      if (query.departmentName) {
        where.departmentName = {
          equals: query.departmentName,
          mode: "insensitive",
        };
      }

      if (query.currentSemester) {
        where.currentSemester = Number(query.currentSemester);
      }

      if (query.name) {
        where.user = {
          name: { contains: query.name, mode: "insensitive" },
        };
      }

      if (query.email) {
        where.user = {
          ...((where.user as Prisma.UserWhereInput) ?? {}),
          email: { contains: query.email, mode: "insensitive" },
        };
      }

      const studentRecords = await db.student.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { usn: "asc" },
      });

      const students: AdminStudentResponseType[] = studentRecords.map(
        (record) => ({
          id: record.id,
          userId: record.userId,
          usn: record.usn,
          name: record.user.name ?? null,
          email: record.user.email ?? null,
          departmentName: record.departmentName,
          currentSemester: record.currentSemester,
          academicYear: record.academicYear,
        })
      );

      return {
        status: "success",
        message: "Students fetched successfully",
        data: students,
      };
    } catch (error) {
      logger.error("Failed to fetch admin students", error);
      throw error;
    }
  }

  /**
   * Hard-deletes a student and their associated User record.
   * Cleans up all dependent relations in a transaction.
   */
  static async deleteStudent(
    studentId: string
  ): Promise<BaseResponse<{ id: string }>> {
    try {
      const student = await db.student.findUnique({
        where: { id: studentId },
        select: { id: true, userId: true },
      });

      if (!student) {
        throw new Error("Student not found");
      }

      await db.$transaction(async (tx) => {
        // 1. Delete relations that reference Student
        await tx.studentSection.deleteMany({
          where: { studentId: student.id },
        });
        await tx.courseRegistration.deleteMany({
          where: { studentId: student.id },
        });
        await tx.mark.deleteMany({
          where: { studentId: student.id },
        });
        await tx.attendance.deleteMany({
          where: { studentId: student.id },
        });

        // 2. Disconnect M2M (Batch)
        await tx.student.update({
          where: { id: student.id },
          data: { batches: { set: [] } },
        });

        // 3. Delete Student record
        await tx.student.delete({
          where: { id: student.id },
        });

        // 4. Delete User record (P2025-safe via deleteMany)
        await tx.user.deleteMany({
          where: { id: student.userId },
        });

        // 5. Clean up auth sessions/accounts for the user
        await tx.session.deleteMany({
          where: { userId: student.userId },
        });
        await tx.account.deleteMany({
          where: { userId: student.userId },
        });
      });

      return {
        status: "success",
        message: "Student deleted successfully",
        data: { id: studentId },
      };
    } catch (error) {
      logger.error("Failed to delete student", error);

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new Error("Student record not found or already deleted");
      }

      throw error;
    }
  }
}
