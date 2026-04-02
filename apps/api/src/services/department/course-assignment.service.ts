import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import type { UpsertCourseMappingType } from "@webcampus/schemas/department";
import type { BaseResponse } from "@webcampus/types/api";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);

export class CourseAssignmentService {
  /**
   * Resolve the requesting department from the user session.
   */
  private static async getRequestingDepartment(requestingUserId: string) {
    const department = await db.department.findFirst({
      where: { userId: requestingUserId },
      select: { id: true, name: true, type: true, abbreviation: true },
    });

    if (!department) {
      throw new Error("Requesting department not found");
    }

    return department;
  }

  /**
   * Get mapping status for all courses in a semester/department.
   * Returns each course with Mapped/Unmapped status.
   */
  static async getMappingStatus(
    semesterId: string,
    departmentName: string,
    academicYear: string,
    cycle?: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const courses = await db.course.findMany({
        where: {
          semesterId,
          departmentName,
          ...(cycle && cycle !== "NONE"
            ? { cycle: cycle as import("@webcampus/db").Cycle }
            : {}),
        },
        select: {
          id: true,
          code: true,
          name: true,
          courseMode: true,
          courseType: true,
          cycle: true,
          lectureCredits: true,
          tutorialCredits: true,
          practicalCredits: true,
          assignments: {
            where: {
              semester: {
                in: await db.semester
                  .findUnique({ where: { id: semesterId } })
                  .then((s) => (s ? [s.semesterNumber] : [])),
              },
              academicYear,
            },
            select: { id: true },
          },
        },
        orderBy: { code: "asc" },
      });

      const data = courses.map((course) => ({
        courseId: course.id,
        code: course.code,
        name: course.name,
        courseMode: course.courseMode,
        courseType: course.courseType,
        cycle: course.cycle,
        lectureCredits: course.lectureCredits,
        tutorialCredits: course.tutorialCredits,
        practicalCredits: course.practicalCredits,
        assignments: course.assignments,
        status: course.assignments.length > 0 ? "Mapped" : "Unmapped",
      }));

      return {
        status: "success",
        message: "Course mapping status fetched",
        data,
      };
    } catch (error) {
      logger.error("Error fetching mapping status:", { error });
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch course mapping status");
    }
  }

  /**
   * Get existing mappings for a specific course.
   * Returns all CourseAssignment records with section/batch/faculty details.
   */
  static async getMappingByCourse(
    courseId: string,
    semesterId: string,
    academicYear: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const semester = await db.semester.findUnique({
        where: { id: semesterId },
      });
      if (!semester) throw new Error("Semester not found");

      const assignments = await db.courseAssignment.findMany({
        where: {
          courseId,
          semester: semester.semesterNumber,
          academicYear,
          section: { semesterId },
        },
        select: {
          id: true,
          sectionId: true,
          facultyId: true,
          assignmentType: true,
          batchId: true,
          batch: {
            select: { name: true },
          },
        },
      });

      const data = assignments.map((a) => ({
        id: a.id,
        sectionId: a.sectionId,
        facultyId: a.facultyId,
        assignmentType: a.assignmentType,
        batchId: a.batchId,
        batchName: a.batch?.name ?? null,
      }));

      return {
        status: "success",
        message: "Course mappings fetched",
        data,
      };
    } catch (error) {
      logger.error("Error fetching course mappings:", { error });
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch course mappings");
    }
  }

  /**
   * Upsert course mappings: delete existing, create new ones.
   * Auto-creates batches if needed.
   */
  static async upsertMapping(
    data: UpsertCourseMappingType,
    requestingUserId: string
  ): Promise<BaseResponse<{ created: number }>> {
    try {
      const department =
        await CourseAssignmentService.getRequestingDepartment(requestingUserId);

      const semester = await db.semester.findUnique({
        where: { id: data.semesterId },
        include: { academicTerm: true },
      });
      if (!semester) throw new Error("Semester not found");

      const course = await db.course.findUnique({
        where: { id: data.courseId },
      });
      if (!course) throw new Error("Course not found");
      if (
        course.approvalStatus === "PENDING" ||
        course.approvalStatus === "APPROVED"
      ) {
        throw new Error(
          "403 Forbidden: Cannot modify faculty assignments for a locked course"
        );
      }

      // RBAC: non-BASIC_SCIENCES cannot map first-year UG semesters
      if (
        department.type !== "BASIC_SCIENCES" &&
        semester.programType === "UG" &&
        FIRST_YEAR_UG_SEMESTERS.has(semester.semesterNumber)
      ) {
        throw new Error(
          "First-year UG semesters are managed by the Basic Sciences department"
        );
      }

      // Validate faculty ownership
      if (department.type !== "BASIC_SCIENCES") {
        const allFacultyIds = new Set<string>();
        for (const mapping of data.sectionMappings) {
          if (mapping.theoryFacultyId) {
            allFacultyIds.add(mapping.theoryFacultyId);
          }
          for (const batch of mapping.labFacultyByBatch ?? []) {
            allFacultyIds.add(batch.facultyId);
          }
        }

        if (allFacultyIds.size > 0) {
          const facultyRecords = await db.faculty.findMany({
            where: {
              id: { in: Array.from(allFacultyIds) },
            },
            select: { id: true, departmentId: true },
          });

          for (const faculty of facultyRecords) {
            if (faculty.departmentId !== department.id) {
              throw new Error(
                `Faculty ${faculty.id} does not belong to your department`
              );
            }
          }
        }
      }

      const result = await db.$transaction(async (tx) => {
        // Delete existing assignments for this course/semester/year
        await tx.courseAssignment.deleteMany({
          where: {
            courseId: data.courseId,
            semester: semester.semesterNumber,
            academicYear: data.academicYear,
            section: { semesterId: data.semesterId },
          },
        });

        let createdCount = 0;

        for (const mapping of data.sectionMappings) {
          // Create THEORY assignment
          if (mapping.theoryFacultyId) {
            await tx.courseAssignment.create({
              data: {
                courseId: data.courseId,
                facultyId: mapping.theoryFacultyId,
                sectionId: mapping.sectionId,
                batchId: null,
                assignmentType: "THEORY",
                semester: semester.semesterNumber,
                academicYear: data.academicYear,
              },
            });
            createdCount++;
          }

          // Create LAB assignments
          for (const batchMapping of mapping.labFacultyByBatch ?? []) {
            // Auto-create batch if it doesn't exist
            let batch = await tx.batch.findFirst({
              where: {
                name: batchMapping.batchName,
                sectionId: mapping.sectionId,
              },
            });

            if (!batch) {
              batch = await tx.batch.create({
                data: {
                  name: batchMapping.batchName,
                  sectionId: mapping.sectionId,
                },
              });
            }

            await tx.courseAssignment.create({
              data: {
                courseId: data.courseId,
                facultyId: batchMapping.facultyId,
                sectionId: mapping.sectionId,
                batchId: batch.id,
                assignmentType: "LAB",
                semester: semester.semesterNumber,
                academicYear: data.academicYear,
              },
            });
            createdCount++;
          }
        }

        return createdCount;
      });

      return {
        status: "success",
        message: `Course mapping saved successfully (${result} assignments)`,
        data: { created: result },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("Duplicate assignment detected");
        }
      }
      if (error instanceof Error) throw error;
      logger.error("Error upserting course mapping:", { error });
      throw new Error("Failed to save course mapping");
    }
  }

  /**
   * Get faculty list for the mapping comboboxes.
   * BASIC_SCIENCES: all faculty across all departments.
   * DEGREE_GRANTING: only faculty from the requesting department.
   */
  static async getFacultyForMapping(
    requestingUserId: string
  ): Promise<
    BaseResponse<{ id: string; name: string; departmentAbbreviation: string }[]>
  > {
    try {
      const department =
        await CourseAssignmentService.getRequestingDepartment(requestingUserId);

      const whereClause: Prisma.FacultyWhereInput =
        department.type === "BASIC_SCIENCES"
          ? {}
          : { departmentId: department.id };

      const faculty = await db.faculty.findMany({
        where: whereClause,
        include: {
          user: { select: { name: true } },
          department: { select: { abbreviation: true } },
        },
        orderBy: { user: { name: "asc" } },
      });

      const data = faculty.map((f) => ({
        id: f.id,
        name: f.user.name,
        departmentAbbreviation: f.department.abbreviation,
      }));

      return {
        status: "success",
        message: "Faculty for mapping fetched",
        data,
      };
    } catch (error) {
      logger.error("Error fetching faculty for mapping:", { error });
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch faculty for mapping");
    }
  }

  /**
   * Get sections for a given semester, optionally filtered by cycle and department.
   */
  static async getSectionsForMapping(
    semesterId: string,
    requestingUserId: string,
    cycle?: string
  ): Promise<
    BaseResponse<
      { id: string; name: string; batches: { id: string; name: string }[] }[]
    >
  > {
    try {
      const department =
        await CourseAssignmentService.getRequestingDepartment(requestingUserId);

      const sections = await db.section.findMany({
        where: {
          semesterId,
          ...(department.type === "BASIC_SCIENCES" && cycle && cycle !== "NONE"
            ? { cycle: cycle as import("@webcampus/db").Cycle }
            : { departmentName: department.name }),
        },
        include: {
          batches: {
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      });

      const data = sections.map((s) => ({
        id: s.id,
        name: s.name,
        batches: s.batches,
      }));

      return {
        status: "success",
        message: "Sections for mapping fetched",
        data,
      };
    } catch (error) {
      logger.error("Error fetching sections for mapping:", { error });
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch sections for mapping");
    }
  }
}
