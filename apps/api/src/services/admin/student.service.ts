import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import { UserService } from "./user.service";
import {
  AdminStudentResponseType,
  GetAdminStudentsQueryType,
} from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";

export class AdminStudentService {
  static async getById(studentId: string): Promise<BaseResponse<unknown>> {
    try {
      await UserService.backfillMissingProfileFields();

      const student = await db.student.findUnique({
        where: { id: studentId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              displayUsername: true,
              image: true,
              createdAt: true,
            },
          },
          department: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!student) {
        throw new Error("Student not found");
      }

      const admission = await db.admission.findFirst({
        where: {
          OR: [{ studentId: student.id }, { tempUsn: student.usn }],
        },
        select: {
          applicationId: true,
          modeOfAdmission: true,
          status: true,
          firstName: true,
          middleName: true,
          lastName: true,
          primaryPhoneNumber: true,
          secondaryPhoneNumber: true,
          primaryEmail: true,
          photo: true,
          categoryClaimed: true,
          categoryAllotted: true,
          quota: true,
          currentAddress: true,
          currentArea: true,
          currentCity: true,
          currentDistrict: true,
          currentState: true,
          currentCountry: true,
          currentPincode: true,
          permanentAddress: true,
          permanentArea: true,
          permanentCity: true,
          permanentDistrict: true,
          permanentState: true,
          permanentCountry: true,
          permanentPincode: true,
          semesterId: true,
          semester: {
            select: {
              programType: true,
              semesterNumber: true,
              academicTermId: true,
              academicTerm: {
                select: {
                  type: true,
                  year: true,
                },
              },
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      });

      const academicTermLabel = admission?.semester?.academicTerm
        ? `${admission.semester.academicTerm.type.toUpperCase()} ${admission.semester.academicTerm.year}`
        : null;

      const resolvedProgramType =
        student.programType ?? admission?.semester?.programType ?? null;
      const resolvedSemesterId = student.semesterId ?? admission?.semesterId ?? null;
      const resolvedTermId =
        student.academicTermId ?? admission?.semester?.academicTermId ?? null;
      const resolvedTermType =
        student.academicTermType ?? admission?.semester?.academicTerm?.type ?? null;
      const resolvedTermYear =
        student.academicTermYear ?? admission?.semester?.academicTerm?.year ?? null;
      const resolvedTermLabel = student.academicTermLabel ?? academicTermLabel;

      return {
        status: "success",
        message: "Student details fetched successfully",
        data: {
          id: student.id,
          usn: student.usn,
          departmentId: student.department?.id ?? null,
          departmentName: student.departmentName,
          currentSemester: student.currentSemester,
          academicYear: student.academicYear,
          semesterId: resolvedSemesterId,
          programType: resolvedProgramType,
          academicTermId: resolvedTermId,
          academicTermType: resolvedTermType,
          academicTermYear: resolvedTermYear,
          academicTermLabel: resolvedTermLabel,
          user: student.user,
          admission,
        },
      };
    } catch (error) {
      logger.error("Failed to fetch admin student details", error);
      throw error;
    }
  }

  /**
   * Fetches all students globally (no department scoping).
   * Used by system admins to view the entire college roster.
   */
  static async getAll(
    query: GetAdminStudentsQueryType
  ): Promise<BaseResponse<AdminStudentResponseType[]>> {
    try {
      await UserService.backfillMissingProfileFields();

      const where: Prisma.StudentWhereInput = {};

      if (query.usn) {
        where.usn = { contains: query.usn, mode: "insensitive" };
      }

      if (query.departmentId) {
        where.department = {
          is: {
            id: query.departmentId,
          },
        };
      }

      if (query.academicYear) {
        where.academicYear = {
          equals: query.academicYear,
          mode: "insensitive",
        };
      }

      if (query.academicTermId || query.programType || query.semesterId) {
        where.admission = {
          is: {
            ...(query.semesterId ? { semesterId: query.semesterId } : {}),
            semester: {
              ...(query.academicTermId
                ? { academicTermId: query.academicTermId }
                : {}),
              ...(query.programType ? { programType: query.programType } : {}),
            },
          },
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
          department: {
            select: {
              id: true,
            },
          },
          admission: {
            select: {
              semesterId: true,
              semester: {
                select: {
                  programType: true,
                  academicTermId: true,
                  academicTerm: {
                    select: {
                      type: true,
                      year: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { usn: "asc" },
      });

      const students: AdminStudentResponseType[] = studentRecords.map(
        (record) => {
          const term = record.admission?.semester?.academicTerm;

          return {
            id: record.id,
            userId: record.userId,
            usn: record.usn,
            name: record.user.name ?? null,
            email: record.user.email ?? null,
            departmentId: record.department?.id ?? null,
            departmentName: record.departmentName,
            currentSemester: record.currentSemester,
            academicYear: record.academicYear,
            semesterId: record.semesterId ?? record.admission?.semesterId ?? null,
            programType:
              record.programType ?? record.admission?.semester?.programType ?? null,
            academicTermId:
              record.academicTermId ??
              record.admission?.semester?.academicTermId ??
              null,
            academicTermType: record.academicTermType ?? term?.type ?? null,
            academicTermYear: record.academicTermYear ?? term?.year ?? null,
            academicTermLabel:
              record.academicTermLabel ??
              (term ? `${term.type.toUpperCase()} ${term.year}` : null),
          };
        }
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
