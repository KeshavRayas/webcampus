import { ensureFreezeRowTx } from "@webcampus/api/src/services/faculty/freeze.service";
import {
  checkAndIncrementOptimisticVersion,
  diffLists,
  logChanges,
} from "@webcampus/api/src/services/shared/audit.service";
import { DepartmentContextResolver } from "@webcampus/api/src/services/shared/department-context-resolver.service";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import type {
  CourseMappingStatusResponseType,
  UpsertCourseMappingType,
} from "@webcampus/schemas/department";
import type { BaseResponse } from "@webcampus/types/api";
import type { DepartmentRequestContext } from "@webcampus/types/request-context";
import ExcelJS from "exceljs";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);

const getCourseMappingStatus = (
  assignmentCount: number
): "Mapped" | "Unmapped" => (assignmentCount > 0 ? "Mapped" : "Unmapped");

type MappingContext = {
  departmentId?: string;
  departmentName?: string;
  requesterRole?: "admin" | "department";
  requestContext?: DepartmentRequestContext;
  adminUserId?: string;
  clientVersion?: number;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
};

export class CourseAssignmentService {
  private static async allocateSectionStudentsToBatches(
    tx: Prisma.TransactionClient,
    sectionId: string,
    semester: number,
    academicYear: string
  ): Promise<void> {
    const [batches, sectionStudents] = await Promise.all([
      tx.batch.findMany({
        where: { sectionId },
        orderBy: { name: "asc" },
        select: { id: true },
      }),
      tx.studentSection.findMany({
        where: {
          sectionId,
          semester,
          academicYear,
        },
        orderBy: {
          student: {
            usn: "asc",
          },
        },
        select: {
          studentId: true,
        },
      }),
    ]);

    if (batches.length === 0 || sectionStudents.length === 0) {
      return;
    }

    for (const batch of batches) {
      await tx.batch.update({
        where: { id: batch.id },
        data: {
          students: {
            set: [],
          },
        },
      });
    }

    const studentIds = sectionStudents.map((entry) => entry.studentId);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const studentsForBatch = studentIds.filter(
        (_, studentIndex) => studentIndex % batches.length === batchIndex
      );

      if (studentsForBatch.length === 0) {
        continue;
      }

      await tx.batch.update({
        where: { id: batches[batchIndex]!.id },
        data: {
          students: {
            connect: studentsForBatch.map((studentId) => ({ id: studentId })),
          },
        },
      });
    }
  }

  /**
   * Resolve the requesting department from the user session.
   */
  private static async getRequestingDepartment(
    requestingUserId: string,
    context?: MappingContext
  ) {
    if (context?.requestContext?.departmentId) {
      const department = await db.department.findUnique({
        where: { id: context.requestContext.departmentId },
        select: { id: true, name: true, type: true, abbreviation: true },
      });

      if (!department) {
        throw new Error("Department not found");
      }

      return department;
    }

    const hasExplicitDepartmentScope =
      Boolean(context?.departmentId) || Boolean(context?.departmentName);

    if (hasExplicitDepartmentScope) {
      const resolved = await DepartmentContextResolver.resolve({
        source: "course-assignment.getRequestingDepartment",
        departmentId: context?.departmentId,
        departmentName: context?.departmentName,
      });

      const explicitDepartment = await db.department.findUnique({
        where: { id: resolved.departmentId },
        select: { id: true, name: true, type: true, abbreviation: true },
      });

      if (!explicitDepartment) {
        throw new Error("Department not found");
      }

      if (context?.requesterRole === "admin") {
        return explicitDepartment;
      }

      const sessionDepartment = await db.department.findFirst({
        where: { userId: requestingUserId },
        select: { id: true, name: true, type: true, abbreviation: true },
      });

      if (!sessionDepartment) {
        throw new Error("Requesting department not found");
      }

      if (explicitDepartment.id !== sessionDepartment.id) {
        throw new Error("Forbidden: department scope mismatch");
      }

      return explicitDepartment;
    }

    if (context?.requesterRole === "admin") {
      throw new Error("departmentId is required");
    }

    const sessionDepartment = await db.department.findFirst({
      where: { userId: requestingUserId },
      select: { id: true, name: true, type: true, abbreviation: true },
    });

    if (!sessionDepartment) {
      throw new Error("Requesting department not found");
    }

    return sessionDepartment;
  }

  /**
   * Get mapping status for all courses in a semester/department.
   * Returns each course with Mapped/Unmapped status.
   */
  static async getMappingStatus(
    semesterId: string,
    academicYear: string,
    requestingUserId: string,
    cycle?: string,
    context?: MappingContext
  ): Promise<BaseResponse<CourseMappingStatusResponseType>> {
    try {
      const department = await CourseAssignmentService.getRequestingDepartment(
        requestingUserId,
        context
      );

      const courses = await db.course.findMany({
        where: {
          semesterId,
          department: {
            is: {
              id: department.id,
            },
          },
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
        status: getCourseMappingStatus(course.assignments.length),
      })) satisfies CourseMappingStatusResponseType["courses"];

      return {
        status: "success",
        message: "Course mapping status fetched",
        data: {
          departmentId: department.id,
          departmentName: department.name,
          courses: data,
        },
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
    academicYear: string,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<unknown>> {
    try {
      const department = await CourseAssignmentService.getRequestingDepartment(
        requestingUserId,
        context
      );

      const semester = await db.semester.findUnique({
        where: { id: semesterId },
      });
      if (!semester) throw new Error("Semester not found");

      const course = await db.course.findFirst({
        where: {
          id: courseId,
          department: {
            is: {
              id: department.id,
            },
          },
        },
        select: { id: true },
      });

      if (!course) {
        throw new Error("Course not found");
      }

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
          faculty: {
            select: {
              shortName: true,
              user: { select: { name: true } },
            },
          },
          section: {
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
        facultyName: a.faculty?.user?.name ?? a.faculty?.shortName ?? null,
        sectionName: a.section?.name ?? null,
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
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<{ created: number }>> {
    try {
      const department = await CourseAssignmentService.getRequestingDepartment(
        requestingUserId,
        context
      );

      const semester = await db.semester.findUnique({
        where: { id: data.semesterId },
        include: { academicTerm: true },
      });
      if (!semester) throw new Error("Semester not found");

      const course = await db.course.findFirst({
        where: {
          id: data.courseId,
          department: {
            is: {
              id: department.id,
            },
          },
        },
      });
      if (!course) throw new Error("Course not found");
      const isLocked =
        course.approvalStatus === "PENDING" ||
        course.approvalStatus === "APPROVED";

      if (isLocked) {
        if (context?.requesterRole !== "admin" || !data.isSuperEdit) {
          throw new Error(
            "403 Forbidden: Cannot modify faculty assignments for a locked course"
          );
        }
      }

      // Capture existing mappings before changes for audit diff
      const existingAssignments =
        context?.requesterRole === "admin"
          ? await db.courseAssignment.findMany({
              where: {
                courseId: data.courseId,
                semester: semester.semesterNumber,
                academicYear: data.academicYear,
                section: { semesterId: data.semesterId },
              },
              select: {
                facultyId: true,
                sectionId: true,
                batchId: true,
                assignmentType: true,
              },
            })
          : null;

      // RBAC: non-BASIC_SCIENCES cannot map first-year UG semesters
      if (
        context?.requesterRole !== "admin" &&
        department.type !== "BASIC_SCIENCES" &&
        semester.programType === "UG" &&
        FIRST_YEAR_UG_SEMESTERS.has(semester.semesterNumber)
      ) {
        throw new Error(
          "First-year UG semesters are managed by the Basic Sciences department"
        );
      }

      // Validate faculty ownership for all departments.
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
        const requestedFacultyIds = Array.from(allFacultyIds);
        const facultyRecords = await db.faculty.findMany({
          where: {
            id: { in: requestedFacultyIds },
          },
          select: { id: true, departmentId: true },
        });

        if (facultyRecords.length !== requestedFacultyIds.length) {
          throw new Error("One or more faculty records are invalid");
        }

        // BASIC_SCIENCES can assign faculty from any department
        if (department.type !== "BASIC_SCIENCES") {
          for (const faculty of facultyRecords) {
            if (faculty.departmentId !== department.id) {
              throw new Error(
                `Faculty ${faculty.id} does not belong to your department`
              );
            }
          }
        }
      }

      // Validate section ownership and semester invariants for every mapping row.
      const sectionIds = [
        ...new Set(data.sectionMappings.map((m) => m.sectionId)),
      ];
      if (sectionIds.length > 0) {
        const sectionRecords = await db.section.findMany({
          where: {
            id: { in: sectionIds },
            semesterId: data.semesterId,
            department: {
              is: {
                id: department.id,
              },
            },
          },
          select: { id: true },
        });

        if (sectionRecords.length !== sectionIds.length) {
          throw new Error(
            "One or more section mappings are invalid for the department or semester"
          );
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

        const createdAssignmentIds: string[] = [];
        let createdCount = 0;
        const labSectionIds = new Set<string>();

        for (const mapping of data.sectionMappings) {
          // Create THEORY assignment
          if (mapping.theoryFacultyId) {
            const created = await tx.courseAssignment.create({
              data: {
                courseId: data.courseId,
                departmentId: department.id,
                facultyId: mapping.theoryFacultyId,
                sectionId: mapping.sectionId,
                batchId: null,
                assignmentType: "THEORY",
                semester: semester.semesterNumber,
                academicYear: data.academicYear,
              },
            });
            createdAssignmentIds.push(created.id);
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

            labSectionIds.add(mapping.sectionId);

            const created = await tx.courseAssignment.create({
              data: {
                courseId: data.courseId,
                departmentId: department.id,
                facultyId: batchMapping.facultyId,
                sectionId: mapping.sectionId,
                batchId: batch.id,
                assignmentType: "LAB",
                semester: semester.semesterNumber,
                academicYear: data.academicYear,
              },
            });
            createdAssignmentIds.push(created.id);
            createdCount++;
          }
        }

        for (const sectionId of labSectionIds) {
          await CourseAssignmentService.allocateSectionStudentsToBatches(
            tx,
            sectionId,
            semester.semesterNumber,
            data.academicYear
          );
        }

        for (const assignmentId of createdAssignmentIds) {
          await ensureFreezeRowTx(tx, assignmentId);
        }

        if (isLocked && data.isSuperEdit) {
          await tx.courseMappingAuditLog.create({
            data: {
              courseId: data.courseId,
              adminId: requestingUserId,
              action: "SUPER_EDIT_MAPPING",
              details: JSON.stringify(data.sectionMappings),
            },
          });
        }

        return createdCount;
      });

      // Audit + optimstic lock for admin overrides
      if (
        context?.requesterRole === "admin" &&
        existingAssignments &&
        context.adminUserId
      ) {
        const newAssignments = await db.courseAssignment.findMany({
          where: {
            courseId: data.courseId,
            semester: semester.semesterNumber,
            academicYear: data.academicYear,
            section: { semesterId: data.semesterId },
          },
          select: {
            facultyId: true,
            sectionId: true,
            batchId: true,
            assignmentType: true,
          },
        });

        const changes: {
          fieldName: string;
          oldValue: unknown;
          newValue: unknown;
        }[] = [];

        const facultyChange = diffLists(
          existingAssignments,
          newAssignments,
          "mappedFaculty",
          (a) =>
            `${a.facultyId}:${a.assignmentType}:${a.sectionId}:${a.batchId ?? ""}`
        );
        if (facultyChange) changes.push(facultyChange);

        if (changes.length > 0) {
          await logChanges({
            entityType: "COURSE_ASSIGNMENT",
            entityId: data.courseId,
            courseId: data.courseId,
            action: "UPSERT_MAPPING",
            changes,
            adminUserId: context.adminUserId,
            reason: context.reason,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          });
        }

        if (context.clientVersion != null) {
          await checkAndIncrementOptimisticVersion(
            data.courseId,
            context.clientVersion,
            context.adminUserId
          );
        }
      }

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
   * Get faculty list for the mapping comboboxes scoped to the resolved department.
   */
  static async getFacultyForMapping(
    requestingUserId: string,
    context?: MappingContext
  ): Promise<
    BaseResponse<{ id: string; name: string; departmentAbbreviation: string }[]>
  > {
    try {
      const department = await CourseAssignmentService.getRequestingDepartment(
        requestingUserId,
        context
      );

      // BASIC_SCIENCES can view and map faculty from all departments
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
    cycle?: string,
    context?: MappingContext
  ): Promise<
    BaseResponse<
      { id: string; name: string; batches: { id: string; name: string }[] }[]
    >
  > {
    try {
      const department = await CourseAssignmentService.getRequestingDepartment(
        requestingUserId,
        context
      );

      const sections = await db.section.findMany({
        where: {
          semesterId,
          department: {
            is: {
              id: department.id,
            },
          },
          ...(cycle && cycle !== "NONE"
            ? { cycle: cycle as import("@webcampus/db").Cycle }
            : {}),
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

  static async deleteMappings(
    courseId: string,
    semesterId: string,
    academicYear: string,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<{ deleted: number }>> {
    try {
      const department = await CourseAssignmentService.getRequestingDepartment(
        requestingUserId,
        context
      );

      const semester = await db.semester.findUnique({
        where: { id: semesterId },
      });

      if (!semester) {
        throw new Error("Semester not found");
      }

      // bypass and audit logic for super edit access for admins

      const course = await db.course.findUnique({ where: { id: courseId } });
      if (
        course &&
        (course.approvalStatus === "PENDING" ||
          course.approvalStatus === "APPROVED")
      ) {
        if (context?.requesterRole !== "admin") {
          throw new Error(
            "403 Forbidden: Cannot delete mappings for a locked course"
          );
        }
      }

      // Capture existing mappings before deletion for audit
      const existingMappings =
        context?.requesterRole === "admin" && context.adminUserId
          ? await db.courseAssignment.findMany({
              where: {
                courseId,
                semester: semester.semesterNumber,
                academicYear,
                section: { semesterId },
                course: {
                  department: { is: { id: department.id } },
                },
              },
              select: {
                facultyId: true,
                sectionId: true,
                batchId: true,
                assignmentType: true,
              },
            })
          : null;

      const result = await db.courseAssignment.deleteMany({
        where: {
          courseId,
          semester: semester.semesterNumber,
          academicYear,
          section: { semesterId },
          course: {
            department: {
              is: {
                id: department.id,
              },
            },
          },
        },
      });

      // Audit the deletion
      if (
        existingMappings &&
        existingMappings.length > 0 &&
        context?.adminUserId
      ) {
        await logChanges({
          entityType: "COURSE_ASSIGNMENT",
          entityId: courseId,
          courseId: courseId,
          action: "DELETE_MAPPING",
          changes: [
            {
              fieldName: "mappedFaculty",
              oldValue: existingMappings.map(
                (m) =>
                  `${m.facultyId}:${m.assignmentType}:${m.sectionId}:${m.batchId ?? ""}`
              ),
              newValue: [],
            },
          ],
          adminUserId: context.adminUserId,
          reason: context.reason,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        if (context.clientVersion != null) {
          await checkAndIncrementOptimisticVersion(
            courseId,
            context.clientVersion,
            context.adminUserId
          );
        }
      }

      return {
        status: "success",
        message: `Deleted ${result.count} mappings`,
        data: { deleted: result.count },
      };
    } catch (error) {
      logger.error("Error deleting course mappings:", { error });
      if (error instanceof Error) throw error;
      throw new Error("Failed to delete course mappings");
    }
  }
  /**
   * Generates an Excel template for course mapping
   */
  static async generateMappingTemplate(
    courseId: string,
    semesterId: string,
    academicYear: string,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<Buffer> {
    const department = await CourseAssignmentService.getRequestingDepartment(
      requestingUserId,
      context
    );

    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        semester: { include: { academicTerm: true } },
      },
    });

    if (!course) throw new Error("Course not found");

    const sections = await db.section.findMany({
      where: {
        semesterId,
        departmentId: department.id,
        ...(course.cycle && course.cycle !== "NONE"
          ? { cycle: course.cycle }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Course Mapping");

    // Add Meta Data (Rows 1-5)
    worksheet.addRow([
      "Academic Term",
      `${course.semester.academicTerm.type} ${course.semester.academicTerm.year}`,
    ]);
    worksheet.addRow(["Semester", course.semester.semesterNumber]);
    worksheet.addRow([
      "Department or Cycle",
      course.cycle !== "NONE" ? course.cycle : department.name,
    ]);
    worksheet.addRow(["Course Name", course.name]);
    worksheet.addRow(["Course Code", course.code]);
    worksheet.addRow([]); // Empty row for spacing

    // Add Table Headers
    const headerRow = worksheet.addRow(["Section", "Faculty Name (Theory)"]);
    headerRow.font = { bold: true };

    // Populate Sections
    sections.forEach((section) => {
      worksheet.addRow([section.name, ""]);
    });

    // Formatting
    worksheet.getColumn(1).width = 20;
    worksheet.getColumn(2).width = 40;

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  /**
   * Parses an uploaded Excel mapping file
   * Note: In a production scenario, you would map string names back to faculty IDs here.
   */
  static async parseMappingUpload(
    fileBuffer: Buffer,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<unknown>> {
    void requestingUserId;
    void context;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) throw new Error("Invalid Excel file format");

    const parsedMappings: { section: string; facultyName: string }[] = [];

    // Assuming table data starts at row 8 based on the generation template
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 8) {
        const sectionName = row.getCell(1).text;
        const facultyName = row.getCell(2).text;

        if (sectionName) {
          parsedMappings.push({
            section: sectionName,
            facultyName: facultyName || "",
          });
        }
      }
    });

    return {
      status: "success",
      message:
        "Excel parsed successfully. Please verify mappings before saving.",
      data: { extractedData: parsedMappings },
    };
  }
}
