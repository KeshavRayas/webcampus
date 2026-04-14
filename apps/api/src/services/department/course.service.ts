import { DepartmentContextResolver } from "@webcampus/api/src/services/shared/department-context-resolver.service";
import { logger } from "@webcampus/common/logger";
import { Course, db, Prisma } from "@webcampus/db";
import {
  CreateCourseDTO,
  UpdateCourseDTO,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import type { DepartmentRequestContext } from "@webcampus/types/request-context";

const MODE_LOCKED_VALUES = {
  INTEGRATED: {
    tutorialCredits: 0,
    skillCredits: 0,
    maxNoOfCies: 3,
    minNoOfCies: 2,
    cieMaxMarks: 40,
    cieMinMarks: 0,
    cieWeightage: 50,
    assignmentMaxMarks: 5,
    labMaxMarks: 25,
    labMinMarks: 10,
    labWeightage: 0,
    cumulativeMaxMarks: 100,
    cumulativeMinMarks: 40,
  },
  NON_INTEGRATED: {
    tutorialCredits: 0,
    practicalCredits: 0,
    skillCredits: 0,
    maxNoOfCies: 3,
    minNoOfCies: 2,
    cieMaxMarks: 40,
    cieMinMarks: 0,
    cieWeightage: 100,
    assignmentMaxMarks: 10,
    labMaxMarks: 0,
    labMinMarks: 0,
    labWeightage: 0,
    cumulativeMaxMarks: 100,
    cumulativeMinMarks: 40,
  },
  FINAL_SUMMARY: {
    tutorialCredits: 0,
    practicalCredits: 0,
    skillCredits: 0,
    maxNoOfCies: 3,
    minNoOfCies: 2,
    cieMaxMarks: 50,
    cieMinMarks: 20,
    cieWeightage: 100,
    noOfAssignments: 0,
    assignmentMaxMarks: 0,
    labMaxMarks: 0,
    labMinMarks: 0,
    labWeightage: 0,
    cumulativeMaxMarks: 100,
    cumulativeMinMarks: 40,
  },
  NCMC: {
    tutorialCredits: 0,
    practicalCredits: 0,
    skillCredits: 0,
    seeMaxMarks: 0,
    seeMinMarks: 0,
    seeWeightage: 0,
    maxNoOfCies: 0,
    minNoOfCies: 0,
    cieMaxMarks: 0,
    cieMinMarks: 0,
    cieWeightage: 0,
    noOfAssignments: 0,
    assignmentMaxMarks: 0,
    labMaxMarks: 0,
    labMinMarks: 0,
    labWeightage: 0,
    cumulativeMaxMarks: 100,
    cumulativeMinMarks: 40,
  },
} as const;

const normalizeByMode = (data: CreateCourseDTO): CreateCourseDTO => {
  const lockedValues = MODE_LOCKED_VALUES[data.courseMode];
  return {
    ...data,
    ...lockedValues,
  };
};

/** Compute derived course fields from user-provided input */
const computeDerivedFields = (data: CreateCourseDTO) => {
  const totalCredits =
    (data.lectureCredits ?? 0) +
    (data.tutorialCredits ?? 0) +
    (data.practicalCredits ?? 0) +
    (data.skillCredits ?? 0);

  const hasLaboratoryComponent =
    data.courseMode === "INTEGRATED" && (data.practicalCredits ?? 0) > 0;

  return { totalCredits, hasLaboratoryComponent };
};

type CourseWithDepartmentContext = Course & {
  departmentId: string;
  departmentName: string;
};

type MappedCourseWithDepartmentContext = CourseWithDepartmentContext & {
  isFullyMapped: boolean;
  isPartiallyMapped: boolean;
  isUnmapped: boolean;
};

export class CourseService {
  private static _ensureCourseIsEditable(status?: string) {
    if (status === "PENDING" || status === "APPROVED") {
      throw new Error(
        "403 Forbidden: Course is locked for review/approval and cannot be modified"
      );
    }
  }

  private static async resolveCourseDepartmentContext(input: {
    source: string;
    departmentId?: string;
    departmentName?: string;
    requestContext?: DepartmentRequestContext;
  }) {
    if (input.requestContext?.departmentId) {
      return DepartmentContextResolver.resolve({
        source: input.source,
        departmentId: input.requestContext.departmentId,
        departmentName: input.requestContext.departmentName,
      });
    }

    return DepartmentContextResolver.resolve({
      source: input.source,
      departmentId: input.departmentId,
      departmentName: input.departmentName,
    });
  }

  private static isKnownApprovalError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return [
      "Role is required for approval",
      "Role is required for requesting revision",
      "Department not found",
      "Ambiguous departmentName mapping",
      "departmentId and departmentName do not match",
      "departmentId is required",
      "Forbidden: department scope mismatch",
    ].includes(error.message);
  }

  static async create(
    data: CreateCourseDTO,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<CourseWithDepartmentContext>> {
    try {
      const resolvedDepartment = await this.resolveCourseDepartmentContext({
        source: "course.create",
        departmentId: data.departmentId,
        departmentName: data.departmentName,
        requestContext,
      });

      const existingInSameSemester = await db.course.findFirst({
        where: {
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
          semesterId: data.semesterId,
          cycle: data.cycle ?? "NONE",
          approvalStatus: { in: ["PENDING", "APPROVED"] },
        },
      });
      if (existingInSameSemester) {
        throw new Error(
          "403 Forbidden: Cannot add courses to a semester that is pending or approved."
        );
      }

      const normalized = normalizeByMode({
        ...data,
        departmentId: resolvedDepartment.departmentId,
        departmentName: resolvedDepartment.departmentName,
      });
      const {
        departmentId: normalizedDepartmentId,
        departmentName: normalizedDepartmentName,
        semesterId,
        cycle,
        ...courseData
      } = normalized;

      if (
        normalizedDepartmentId !== resolvedDepartment.departmentId ||
        normalizedDepartmentName !== resolvedDepartment.departmentName
      ) {
        throw new Error("Forbidden: department scope mismatch");
      }

      const derived = computeDerivedFields(normalized);

      const course = await db.course.create({
        data: {
          ...courseData,
          ...derived,
          cycle: cycle ?? "NONE",
          department: {
            connect: {
              id: resolvedDepartment.departmentId,
            },
          },
          semester: {
            connect: {
              id: semesterId,
            },
          },
        },
      });

      const response: BaseResponse<CourseWithDepartmentContext> = {
        status: "success",
        message: "Course created successfully",
        data: {
          ...course,
          departmentId: resolvedDepartment.departmentId,
          departmentName: resolvedDepartment.departmentName,
        },
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("Course already exists");
        }
      }
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Failed to create course", error);
      throw new Error("Failed to create course");
    }
  }

  static async update(
    data: UpdateCourseDTO,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<CourseWithDepartmentContext>> {
    try {
      const { id, departmentName, semesterId, cycle, ...updateFields } = data;

      const resolvedDepartment = await this.resolveCourseDepartmentContext({
        source: "course.update",
        departmentId: data.departmentId,
        departmentName: departmentName,
        requestContext,
      });

      const existing = await db.course.findFirst({
        where: {
          id,
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
        },
      });
      if (!existing) {
        throw new Error("Course not found");
      }

      this._ensureCourseIsEditable(existing.approvalStatus);

      const merged: CreateCourseDTO = {
        code: updateFields.code ?? existing.code,
        name: updateFields.name ?? existing.name,
        courseMode: updateFields.courseMode ?? existing.courseMode,
        courseType: updateFields.courseType ?? existing.courseType,
        cycle: cycle ?? existing.cycle,
        departmentId: resolvedDepartment.departmentId,
        departmentName: resolvedDepartment.departmentName,
        semesterId: semesterId ?? existing.semesterId,
        semesterNumber: updateFields.semesterNumber ?? existing.semesterNumber,
        lectureCredits: updateFields.lectureCredits ?? existing.lectureCredits,
        tutorialCredits:
          updateFields.tutorialCredits ?? existing.tutorialCredits,
        practicalCredits:
          updateFields.practicalCredits ?? existing.practicalCredits,
        skillCredits: updateFields.skillCredits ?? existing.skillCredits,
        seeMaxMarks: updateFields.seeMaxMarks ?? existing.seeMaxMarks,
        seeMinMarks: updateFields.seeMinMarks ?? existing.seeMinMarks,
        seeWeightage: updateFields.seeWeightage ?? existing.seeWeightage,
        maxNoOfCies: updateFields.maxNoOfCies ?? existing.maxNoOfCies,
        minNoOfCies: updateFields.minNoOfCies ?? existing.minNoOfCies,
        cieMaxMarks: updateFields.cieMaxMarks ?? existing.cieMaxMarks,
        cieMinMarks: updateFields.cieMinMarks ?? existing.cieMinMarks,
        cieWeightage: updateFields.cieWeightage ?? existing.cieWeightage,
        noOfAssignments:
          updateFields.noOfAssignments ?? existing.noOfAssignments,
        assignmentMaxMarks:
          updateFields.assignmentMaxMarks ?? existing.assignmentMaxMarks,
        labMaxMarks: updateFields.labMaxMarks ?? existing.labMaxMarks,
        labMinMarks: updateFields.labMinMarks ?? existing.labMinMarks,
        labWeightage: updateFields.labWeightage ?? existing.labWeightage,
        cumulativeMaxMarks:
          updateFields.cumulativeMaxMarks ?? existing.cumulativeMaxMarks,
        cumulativeMinMarks:
          updateFields.cumulativeMinMarks ?? existing.cumulativeMinMarks,
      };

      const normalizedMerged = normalizeByMode(merged);
      const derived = computeDerivedFields(normalizedMerged);
      const {
        departmentId: normalizedDepartmentId,
        departmentName: normalizedDepartmentName,
        semesterId: normalizedSemesterId,
        cycle: normalizedCycle,
        ...normalizedCourseFields
      } = normalizedMerged;

      if (
        normalizedDepartmentId &&
        normalizedDepartmentId !== resolvedDepartment.departmentId
      ) {
        throw new Error("Forbidden: department scope mismatch");
      }

      const course = await db.course.update({
        where: { id },
        data: {
          ...normalizedCourseFields,
          ...derived,
          ...(normalizedCycle ? { cycle: normalizedCycle } : {}),
          ...(normalizedDepartmentName
            ? {
                department: {
                  connect: {
                    id: resolvedDepartment.departmentId,
                  },
                },
              }
            : {}),
          ...(normalizedSemesterId
            ? { semester: { connect: { id: normalizedSemesterId } } }
            : {}),
        },
      });

      const response: BaseResponse<CourseWithDepartmentContext> = {
        status: "success",
        message: "Course updated successfully",
        data: {
          ...course,
          departmentId: resolvedDepartment.departmentId,
          departmentName: resolvedDepartment.departmentName,
        },
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Failed to update course", error);
      throw new Error("Failed to update course");
    }
  }

  static async delete(
    id: string,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<null>> {
    try {
      const resolvedDepartment = await this.resolveCourseDepartmentContext({
        source: "course.delete",
        requestContext,
      });

      const existing = await db.course.findFirst({
        where: {
          id,
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
        },
        include: {
          _count: {
            select: {
              assignments: true,
              registrations: true,
              marks: true,
              attendances: true,
            },
          },
        },
      });

      if (!existing) {
        throw new Error("Course not found");
      }

      this._ensureCourseIsEditable(existing.approvalStatus);

      const { assignments, registrations, marks, attendances } =
        existing._count;
      if (assignments + registrations + marks + attendances > 0) {
        throw new Error(
          "Cannot delete: course has active assignments, registrations, marks, or attendance records. Remove these dependencies first."
        );
      }

      await db.course.delete({ where: { id } });

      const response: BaseResponse<null> = {
        status: "success",
        message: "Course deleted successfully",
        data: null,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Failed to delete course", error);
      throw new Error("Failed to delete course");
    }
  }

  static async getById(
    id: string,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<Course>> {
    try {
      const resolvedDepartment = await this.resolveCourseDepartmentContext({
        source: "course.getById",
        requestContext,
      });

      const course = await db.course.findFirst({
        where: {
          id,
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
        },
      });

      if (!course) {
        const errorMessage = "Course not found";
        logger.warn(errorMessage, { courseId: id });
        throw new Error(errorMessage);
      }

      const response: BaseResponse<Course> = {
        status: "success",
        message: "Course fetched successfully",
        data: course,
      };

      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Error && error.message === "Course not found") {
        throw error;
      }
      logger.error("Failed to fetch course", error);
      throw error;
    }
  }

  static async getByBranch(
    departmentId?: string,
    departmentName?: string,
    semesterId?: string,
    cycle?: string,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<MappedCourseWithDepartmentContext[]>> {
    try {
      const resolvedDepartment = await this.resolveCourseDepartmentContext({
        source: "course.getByBranch",
        departmentId,
        departmentName,
        requestContext,
      });

      const relevantSections = await db.section.findMany({
        where: {
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
          ...(semesterId ? { semesterId } : {}),
          ...(cycle && cycle !== "NONE"
            ? { cycle: cycle as import("@webcampus/db").Cycle }
            : {}),
        },
        include: {
          _count: { select: { batches: true } },
        },
      });

      const sectionCounts = relevantSections.reduce(
        (acc, sec) => {
          const key = `${sec.semesterId}_${sec.cycle}`;
          if (!acc[key]) acc[key] = { sections: 0, batches: 0 };
          acc[key].sections += 1;
          acc[key].batches += sec._count.batches;
          return acc;
        },
        {} as Record<string, { sections: number; batches: number }>
      );
      const courses = await db.course.findMany({
        where: {
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
          ...(semesterId ? { semesterId } : {}),
          ...(cycle && cycle !== "NONE"
            ? { cycle: cycle as import("@webcampus/db").Cycle }
            : {}),
        },
        include: {
          _count: {
            select: { assignments: true },
          },
        },
        orderBy: { code: "asc" },
      });

      const mappedCourses = courses.map((course) => {
        const key = `${course.semesterId}_${course.cycle}`;
        const counts = sectionCounts[key] || { sections: 0, batches: 0 };

        let expectedAssignments = 0;
        if (
          course.courseMode === "NON_INTEGRATED" ||
          course.courseMode === "NCMC"
        ) {
          expectedAssignments = counts.sections;
        } else if (course.courseMode === "FINAL_SUMMARY") {
          expectedAssignments = counts.batches;
        } else if (course.courseMode === "INTEGRATED") {
          expectedAssignments = counts.sections + counts.batches;
        }

        const assignmentCount = course._count.assignments;

        return {
          ...course,
          departmentId: resolvedDepartment.departmentId,
          departmentName: resolvedDepartment.departmentName,
          isFullyMapped:
            expectedAssignments > 0
              ? assignmentCount >= expectedAssignments
              : true,
          isPartiallyMapped:
            assignmentCount > 0 && assignmentCount < expectedAssignments,
          isUnmapped: assignmentCount === 0 || expectedAssignments === 0,
        };
      });

      return {
        status: "success",
        message: "Courses fetched successfully",
        data: mappedCourses,
      };
    } catch (error) {
      logger.error("Error fetching courses by branch", error);
      throw new Error("Failed to fetch courses");
    }
  }

  static async getAllByDepartment(
    departmentId?: string,
    departmentName?: string,
    semesterId?: string,
    cycle?: string
  ): Promise<BaseResponse<CourseWithDepartmentContext[]>> {
    try {
      const resolvedDepartment = await this.resolveCourseDepartmentContext({
        source: "course.getAllByDepartment",
        departmentId,
        departmentName,
      });

      const courses = await db.course.findMany({
        where: {
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
          ...(semesterId ? { semesterId } : {}),
          ...(cycle && cycle !== "NONE"
            ? { cycle: cycle as import("@webcampus/db").Cycle }
            : {}),
        },
        include: {
          semester: {
            include: {
              academicTerm: true,
            },
          },
        },
      });

      const response: BaseResponse<CourseWithDepartmentContext[]> = {
        status: "success",
        message: "Courses fetched successfully",
        data: courses.map((course) => ({
          ...course,
          departmentId: resolvedDepartment.departmentId,
          departmentName: resolvedDepartment.departmentName,
        })),
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error("Failed to fetch courses by department", error);
      throw error;
    }
  }

  static async bulkSubmitForApproval(
    semesterId: string,
    departmentId?: string,
    departmentName?: string,
    cycle?: string,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<{ count: number }>> {
    try {
      const resolvedDepartment = await this.resolveCourseDepartmentContext({
        source: "course.bulkSubmitForApproval",
        departmentId,
        departmentName,
        requestContext,
      });

      const result = await db.course.updateMany({
        where: {
          semesterId,
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
          approvalStatus: { in: ["DRAFT", "NEEDS_REVISION"] },
          ...(cycle && cycle !== "NONE"
            ? { cycle: cycle as import("@webcampus/db").Cycle }
            : {}),
        },
        data: {
          approvalStatus: "PENDING",
          approvedByRole: null,
          approvedByUsername: null,
          approvedByDisplay: null,
          approvedAt: null,
          revisionRequestedByRole: null,
          revisionNotes: null,
          revisionRequestedAt: null,
        },
      });

      const response: BaseResponse<{ count: number }> = {
        status: "success",
        message: `Successfully submitted ${result.count} courses for approval`,
        data: { count: result.count },
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error("Failed to bulk submit courses for approval", error);
      throw new Error("Failed to bulk submit courses");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async getGroupedCourseSubmissions(_role: "admin" | "coe"): Promise<
    BaseResponse<
      Array<{
        id: string;
        departmentId: string;
        departmentName: string;
        departmentCode?: string;
        semesterId: string;
        semester: import("@webcampus/db").Semester & {
          academicTerm: import("@webcampus/db").AcademicTerm;
        };
        cycle: string;
        courseCount: number;
        courses: Course[];
      }>
    >
  > {
    try {
      const pendingCourses = await db.course.findMany({
        where: {
          approvalStatus: "PENDING",
        },
        include: {
          department: { select: { id: true, code: true, name: true } },
          semester: {
            include: { academicTerm: true },
          },
          assignments: {
            include: {
              faculty: { select: { shortName: true } },
              batch: { select: { name: true } },
            },
          },
        },
        orderBy: { code: "asc" },
      });

      const groupedMap = new Map<
        string,
        {
          id: string;
          departmentId: string;
          departmentName: string;
          departmentCode?: string;
          semesterId: string;
          semester: import("@webcampus/db").Semester & {
            academicTerm: import("@webcampus/db").AcademicTerm;
          };
          cycle: string;
          courseCount: number;
          courses: Course[];
        }
      >();

      for (const course of pendingCourses) {
        const key = `${course.department.id}_${course.semesterId}_${course.cycle}`;
        if (!groupedMap.has(key)) {
          groupedMap.set(key, {
            id: key,
            departmentId: course.department.id,
            departmentName: course.department.name,
            departmentCode: course.department?.code,
            semesterId: course.semesterId,
            semester: course.semester,
            cycle: course.cycle,
            courseCount: 0,
            courses: [],
          });
        }
        const group = groupedMap.get(key);
        if (group) {
          group.courseCount += 1;
          group.courses.push(course);
        }
      }

      const groupedArray = Array.from(groupedMap.values());

      return {
        status: "success",
        message: "Fetched grouped course submissions",
        data: groupedArray,
      };
    } catch (error) {
      logger.error("Failed to fetch grouped course submissions", error);
      throw new Error("Failed to fetch pending courses");
    }
  }

  static async approveSemesterCourses(
    semesterId: string,
    departmentId?: string,
    departmentName?: string,
    cycle?: string,
    role?: "admin" | "coe",
    approverUsername?: string | null,
    approverDisplayUsername?: string | null
  ): Promise<BaseResponse<{ count: number }>> {
    try {
      if (!role) throw new Error("Role is required for approval");
      const resolvedDepartment = await this.resolveCourseDepartmentContext({
        source: "course.approveSemesterCourses",
        departmentId,
        departmentName,
      });

      const resolvedCoeUsername =
        approverDisplayUsername?.trim() || approverUsername?.trim() || "COE";
      const approvedByDisplay =
        role === "admin" ? "Admin" : resolvedCoeUsername;

      const result = await db.course.updateMany({
        where: {
          semesterId,
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
          approvalStatus: "PENDING",
          ...(cycle && cycle !== "NONE"
            ? { cycle: cycle as import("@webcampus/db").Cycle }
            : {}),
        },
        data: {
          approvalStatus: "APPROVED",
          approvedByRole: role,
          approvedByUsername:
            role === "coe" ? resolvedCoeUsername : (approverUsername ?? null),
          approvedByDisplay,
          approvedAt: new Date(),
        },
      });

      return {
        status: "success",
        message: `Successfully approved ${result.count} courses`,
        data: { count: result.count },
      };
    } catch (error) {
      logger.error("Failed to approve courses", error);
      if (CourseService.isKnownApprovalError(error)) {
        throw error;
      }

      throw new Error("Failed to approve courses");
    }
  }

  static async requestRevisionForSemester(
    semesterId: string,
    departmentId: string | undefined,
    departmentName: string | undefined,
    reviewerNotes: string,
    cycle?: string,
    role?: "admin" | "coe"
  ): Promise<BaseResponse<{ count: number }>> {
    try {
      if (!role) throw new Error("Role is required for requesting revision");
      const resolvedDepartment = await this.resolveCourseDepartmentContext({
        source: "course.requestRevisionForSemester",
        departmentId,
        departmentName,
      });
      const result = await db.course.updateMany({
        where: {
          semesterId,
          department: {
            is: {
              id: resolvedDepartment.departmentId,
            },
          },
          approvalStatus: "PENDING",
          ...(cycle && cycle !== "NONE"
            ? { cycle: cycle as import("@webcampus/db").Cycle }
            : {}),
        },
        data: {
          approvalStatus: "NEEDS_REVISION",
          revisionRequestedByRole: role,
          revisionNotes: reviewerNotes,
          revisionRequestedAt: new Date(),
        },
      });

      return {
        status: "success",
        message: `Successfully requested revision for ${result.count} courses`,
        data: { count: result.count },
      };
    } catch (error) {
      logger.error("Failed to request revision for courses", error);
      if (CourseService.isKnownApprovalError(error)) {
        throw error;
      }

      throw new Error("Failed to request revision for courses");
    }
  }

  /**
   * Fetch all coordinators assigned to a specific course.
   */
  static async getCoordinators(
    courseId: string,
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<unknown[]>> {
    try {
      const resolvedDepartment = await this.resolveCourseDepartmentContext({
        source: "course.getCoordinators",
        requestContext,
      });

      const course = await db.course.findFirst({
        where: {
          id: courseId,
          department: {
            is: { id: resolvedDepartment.departmentId },
          },
        },
        select: { id: true },
      });

      if (!course) {
        throw new Error("Course not found");
      }

      const coordinators = await db.courseCoordinator.findMany({
        where: { courseId },
        include: {
          faculty: {
            select: {
              id: true,
              shortName: true,
              departmentId: true,
              user: {
                select: { name: true },
              },
            },
          },
        },
      });

      return {
        status: "success",
        message: "Coordinators fetched successfully",
        data: coordinators,
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Course not found") {
        throw error;
      }
      logger.error("Failed to fetch coordinators", error);
      throw new Error("Failed to fetch coordinators");
    }
  }

  /**
   * Replace all coordinators for a course with the given faculty IDs.
   * Uses a transaction to atomically delete existing + create new entries.
   */
  static async updateCoordinators(
    courseId: string,
    facultyIds: string[],
    requestContext?: DepartmentRequestContext
  ): Promise<BaseResponse<{ count: number }>> {
    try {
      const resolvedDepartment = await this.resolveCourseDepartmentContext({
        source: "course.updateCoordinators",
        requestContext,
      });

      const course = await db.course.findFirst({
        where: {
          id: courseId,
          department: {
            is: { id: resolvedDepartment.departmentId },
          },
        },
        select: { id: true, approvalStatus: true },
      });

      if (!course) {
        throw new Error("Course not found");
      }

      this._ensureCourseIsEditable(course.approvalStatus);

      await db.$transaction(async (tx) => {
        await tx.courseCoordinator.deleteMany({
          where: { courseId },
        });

        if (facultyIds.length > 0) {
          await tx.courseCoordinator.createMany({
            data: facultyIds.map((facultyId) => ({
              courseId,
              facultyId,
            })),
          });
        }
      });

      return {
        status: "success",
        message: `Successfully updated coordinators (${facultyIds.length} assigned)`,
        data: { count: facultyIds.length },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Failed to update coordinators", error);
      throw new Error("Failed to update coordinators");
    }
  }

  /**
   * Get distinct faculty members currently mapped to a course via CourseAssignment.
   * Used by the coordinator assignment UI to restrict the dropdown to only
   * faculty who are already teaching the course.
   */
  static async getMappedFacultyForCourse(
    courseId: string,
    requestContext?: DepartmentRequestContext
  ): Promise<
    BaseResponse<{ id: string; name: string; departmentAbbreviation: string }[]>
  > {
    try {
      const resolvedDepartment = await this.resolveCourseDepartmentContext({
        source: "course.getMappedFacultyForCourse",
        requestContext,
      });

      // Verify the course belongs to the requesting department
      const course = await db.course.findFirst({
        where: {
          id: courseId,
          department: {
            is: { id: resolvedDepartment.departmentId },
          },
        },
        select: { id: true },
      });

      if (!course) {
        throw new Error("Course not found");
      }

      const assignments = await db.courseAssignment.findMany({
        where: { courseId },
        select: {
          facultyId: true,
          faculty: {
            select: {
              id: true,
              user: { select: { name: true } },
              department: { select: { abbreviation: true } },
            },
          },
        },
      });

      // Deduplicate by facultyId (a faculty may teach multiple sections/batches)
      const seen = new Set<string>();
      const uniqueFaculty: {
        id: string;
        name: string;
        departmentAbbreviation: string;
      }[] = [];

      for (const assignment of assignments) {
        if (!seen.has(assignment.facultyId)) {
          seen.add(assignment.facultyId);
          uniqueFaculty.push({
            id: assignment.faculty.id,
            name: assignment.faculty.user.name,
            departmentAbbreviation: assignment.faculty.department.abbreviation,
          });
        }
      }

      // Sort alphabetically by name
      uniqueFaculty.sort((a, b) => a.name.localeCompare(b.name));

      return {
        status: "success",
        message: `Found ${uniqueFaculty.length} mapped faculty for course`,
        data: uniqueFaculty,
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Course not found") {
        throw error;
      }
      logger.error("Failed to fetch mapped faculty for course", error);
      throw new Error("Failed to fetch mapped faculty for course");
    }
  }
}
