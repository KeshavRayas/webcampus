import { dayjs } from "@webcampus/common/dayjs";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import type {
  ArchiveResultType,
  ArchiveSemesterQueryType,
  ArchiveSummaryType,
} from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";

export class ArchiveService {
  /**
   * Checks whether a semester's computed lifecycle status is ARCHIVED.
   * Mirrors the logic in SemesterService.getSemesterStatus.
   */
  private static isSemesterArchived(startDate: Date, endDate: Date): boolean {
    const end = dayjs(endDate).endOf("day");
    const today = dayjs();
    console.log(startDate);
    return today.isAfter(end);
  }

  /**
   * Archives a semester and all related Department, Faculty, and Admin records.
   *
   * This creates snapshot records in the archive tables within a single transaction.
   * The operation is idempotent — if the semester has already been archived, it returns
   * without creating duplicate records.
   *
   * @param archivedByUserId - Defaults to "SYSTEM" for automatic archival.
   */
  static async archiveSemester(
    semesterId: string,
    archivedByUserId: string = "SYSTEM"
  ): Promise<BaseResponse<ArchiveResultType>> {
    try {
      // 1. Fetch the semester with its academic term
      const semester = await db.semester.findUnique({
        where: { id: semesterId },
        include: {
          academicTerm: true,
        },
      });

      if (!semester) {
        throw new Error("Semester not found");
      }

      // 2. Validate the semester is actually ARCHIVED (past its end date)
      if (
        !ArchiveService.isSemesterArchived(semester.startDate, semester.endDate)
      ) {
        throw new Error(
          "Semester is not yet archived. Only semesters past their end date can be archived."
        );
      }

      // 3. Check idempotency — skip if already archived
      const existingArchive = await db.archivedSemester.findFirst({
        where: { originalId: semesterId },
      });

      if (existingArchive) {
        throw new Error(
          "This semester has already been archived. Duplicate archival is not allowed."
        );
      }

      // 4. Gather all related data for archival

      // Departments: those that have sections in this semester
      const departments = await db.department.findMany({
        where: {
          sections: {
            some: { semesterId },
          },
        },
        include: {
          userMemberships: true,
          hods: { include: { user: true } },
        },
      });

      // Faculty: those that have course assignments in this semester
      const facultyMembers = await db.faculty.findMany({
        where: {
          teaches: {
            some: {
              section: { semesterId },
            },
          },
        },
        include: {
          user: true,
          department: true,
          teaches: {
            where: {
              section: { semesterId },
            },
            include: {
              course: true,
              section: true,
              batch: true,
            },
          },
        },
      });

      // Admins: all admin users at time of archival (not semester-scoped)
      const admins = await db.admin.findMany({
        include: {
          user: true,
        },
      });

      // 5. Execute archival within a single transaction
      const result = await db.$transaction(async (tx) => {
        // Archive the semester
        const archivedSemester = await tx.archivedSemester.create({
          data: {
            originalId: semester.id,
            semesterNumber: semester.semesterNumber,
            programType: semester.programType,
            academicTermId: semester.academicTermId,
            academicTermType: semester.academicTerm.type,
            academicTermYear: semester.academicTerm.year,
            startDate: semester.startDate,
            endDate: semester.endDate,
            snapshot: JSON.parse(JSON.stringify(semester)),
            archivedBy: archivedByUserId,
          },
        });

        // Archive departments
        const archivedDepartments = await Promise.all(
          departments.map((dept) =>
            tx.archivedDepartment.create({
              data: {
                originalId: dept.id,
                name: dept.name,
                code: dept.code,
                abbreviation: dept.abbreviation,
                type: dept.type,
                semesterId: semester.id,
                snapshot: JSON.parse(JSON.stringify(dept)),
                archivedBy: archivedByUserId,
              },
            })
          )
        );

        // Archive faculty
        const archivedFaculty = await Promise.all(
          facultyMembers.map((fac) =>
            tx.archivedFaculty.create({
              data: {
                originalId: fac.id,
                userId: fac.userId,
                departmentId: fac.departmentId,
                designation: fac.designation,
                shortName: fac.shortName,
                employeeId: fac.employeeId,
                semesterId: semester.id,
                snapshot: JSON.parse(JSON.stringify(fac)),
                archivedBy: archivedByUserId,
              },
            })
          )
        );

        // Archive admins
        const archivedAdmins = await Promise.all(
          admins.map((admin) =>
            tx.archivedAdmin.create({
              data: {
                originalId: admin.id,
                userId: admin.userId,
                semesterId: semester.id,
                snapshot: JSON.parse(JSON.stringify(admin)),
                archivedBy: archivedByUserId,
              },
            })
          )
        );

        return {
          archivedSemester,
          departmentCount: archivedDepartments.length,
          facultyCount: archivedFaculty.length,
          adminCount: archivedAdmins.length,
        };
      });

      const response: BaseResponse<ArchiveResultType> = {
        status: "success",
        message: `Semester archived successfully. Archived ${result.departmentCount} departments, ${result.facultyCount} faculty, ${result.adminCount} admins.`,
        data: {
          semester: {
            id: result.archivedSemester.id,
            originalId: result.archivedSemester.originalId,
            semesterNumber: result.archivedSemester.semesterNumber,
            programType: result.archivedSemester.programType,
          },
          archivedCounts: {
            departments: result.departmentCount,
            faculty: result.facultyCount,
            admins: result.adminCount,
          },
          archivedAt: result.archivedSemester.archivedAt,
        },
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error({ error });
      throw error instanceof Error
        ? error
        : new Error("Failed to archive semester");
    }
  }

  /**
   * Automatically archives semesters that have transitioned to ARCHIVED status.
   * Called as fire-and-forget from SemesterService when it detects newly archived semesters.
   * Each semester is processed independently — failures are logged but don't affect others.
   */
  static async autoArchiveSemesters(semesterIds: string[]): Promise<void> {
    for (const semesterId of semesterIds) {
      try {
        const existing = await db.archivedSemester.findFirst({
          where: { originalId: semesterId },
        });

        if (!existing) {
          await ArchiveService.archiveSemester(semesterId);
          logger.info({
            message: `Auto-archived semester ${semesterId}`,
          });
        }
      } catch (error) {
        logger.error({
          error,
          semesterId,
          message: "Auto-archive failed for semester",
        });
      }
    }
  }

  /**
   * Returns archive summary for a specific semester.
   */
  static async getArchiveSummary(
    semesterId: string
  ): Promise<BaseResponse<ArchiveSummaryType | null>> {
    try {
      const archivedSemester = await db.archivedSemester.findFirst({
        where: { originalId: semesterId },
      });

      if (!archivedSemester) {
        const response: BaseResponse<null> = {
          status: "success",
          message: "No archive found for this semester",
          data: null,
        };
        return response;
      }

      const [departmentCount, facultyCount, adminCount] = await Promise.all([
        db.archivedDepartment.count({
          where: { semesterId },
        }),
        db.archivedFaculty.count({
          where: { semesterId },
        }),
        db.archivedAdmin.count({
          where: { semesterId },
        }),
      ]);

      const response: BaseResponse<ArchiveSummaryType> = {
        status: "success",
        message: "Archive summary fetched successfully",
        data: {
          semesterId: archivedSemester.originalId,
          semesterNumber: archivedSemester.semesterNumber,
          programType: archivedSemester.programType,
          academicTermType: archivedSemester.academicTermType,
          academicTermYear: archivedSemester.academicTermYear,
          archivedAt: archivedSemester.archivedAt,
          archivedBy: archivedSemester.archivedBy,
          counts: {
            departments: departmentCount,
            faculty: facultyCount,
            admins: adminCount,
          },
        },
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error({ error });
      throw new Error("Failed to fetch archive summary");
    }
  }

  /**
   * Lists all archived semesters with their archive counts.
   */
  static async getAllArchives(
    query: ArchiveSemesterQueryType
  ): Promise<BaseResponse<ArchiveSummaryType[]>> {
    try {
      const where: Record<string, unknown> = {};
      if (query.academicTermId) where.academicTermId = query.academicTermId;
      if (query.programType) where.programType = query.programType;

      const archivedSemesters = await db.archivedSemester.findMany({
        where,
        orderBy: { archivedAt: "desc" },
      });

      const summaries: ArchiveSummaryType[] = await Promise.all(
        archivedSemesters.map(async (archived) => {
          const [departmentCount, facultyCount, adminCount] = await Promise.all(
            [
              db.archivedDepartment.count({
                where: { semesterId: archived.originalId },
              }),
              db.archivedFaculty.count({
                where: { semesterId: archived.originalId },
              }),
              db.archivedAdmin.count({
                where: { semesterId: archived.originalId },
              }),
            ]
          );

          return {
            semesterId: archived.originalId,
            semesterNumber: archived.semesterNumber,
            programType: archived.programType,
            academicTermType: archived.academicTermType,
            academicTermYear: archived.academicTermYear,
            archivedAt: archived.archivedAt,
            archivedBy: archived.archivedBy,
            counts: {
              departments: departmentCount,
              faculty: facultyCount,
              admins: adminCount,
            },
          };
        })
      );

      const response: BaseResponse<ArchiveSummaryType[]> = {
        status: "success",
        message: "Archives fetched successfully",
        data: summaries,
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error({ error });
      throw new Error("Failed to fetch archives");
    }
  }
}
