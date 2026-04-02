import { logger } from "@webcampus/common/logger";
import { Course, db, Prisma } from "@webcampus/db";
import {
  CreateCourseDTO,
  UpdateCourseDTO,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";

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

export class CourseService {
  private static _ensureCourseIsEditable(status?: string) {
    if (status === "PENDING" || status === "APPROVED") {
      throw new Error(
        "403 Forbidden: Course is locked for review/approval and cannot be modified"
      );
    }
  }

  static async create(data: CreateCourseDTO): Promise<BaseResponse<Course>> {
    try {
      const existingInSameSemester = await db.course.findFirst({
        where: {
          departmentName: data.departmentName,
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

      const normalized = normalizeByMode(data);
      const { departmentName, semesterId, cycle, ...courseData } = normalized;
      const derived = computeDerivedFields(normalized);

      const course = await db.course.create({
        data: {
          ...courseData,
          ...derived,
          cycle: cycle ?? "NONE",
          department: {
            connect: {
              name: departmentName,
            },
          },
          semester: {
            connect: {
              id: semesterId,
            },
          },
        },
      });

      const response: BaseResponse<Course> = {
        status: "success",
        message: "Course created successfully",
        data: course,
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

  static async update(data: UpdateCourseDTO): Promise<BaseResponse<Course>> {
    try {
      const { id, departmentName, semesterId, cycle, ...updateFields } = data;

      // Fetch existing course to merge with partial update for derived computation
      const existing = await db.course.findUnique({ where: { id } });
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
        departmentName: departmentName ?? existing.departmentName,
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
        departmentName: normalizedDepartmentName,
        semesterId: normalizedSemesterId,
        cycle: normalizedCycle,
        ...normalizedCourseFields
      } = normalizedMerged;

      const course = await db.course.update({
        where: { id },
        data: {
          ...normalizedCourseFields,
          ...derived,
          ...(normalizedCycle ? { cycle: normalizedCycle } : {}),
          ...(normalizedDepartmentName
            ? { department: { connect: { name: normalizedDepartmentName } } }
            : {}),
          ...(normalizedSemesterId
            ? { semester: { connect: { id: normalizedSemesterId } } }
            : {}),
        },
      });

      const response: BaseResponse<Course> = {
        status: "success",
        message: "Course updated successfully",
        data: course,
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

  static async delete(id: string): Promise<BaseResponse<null>> {
    try {
      const existing = await db.course.findUnique({
        where: { id },
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

  static async getById(id: string): Promise<BaseResponse<Course>> {
    try {
      const course = await db.course.findUnique({
        where: { id },
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
    name: string,
    semesterId?: string,
    cycle?: string
  ): Promise<
    BaseResponse<
      Array<
        Course & {
          isFullyMapped: boolean;
          isPartiallyMapped: boolean;
          isUnmapped: boolean;
        }
      >
    >
  > {
    try {
      const relevantSections = await db.section.findMany({
        where: {
          departmentName: name,
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
            name: {
              equals: name,
              mode: "insensitive",
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
    name: string,
    semesterId?: string,
    cycle?: string
  ): Promise<BaseResponse<Course[]>> {
    try {
      const courses = await db.course.findMany({
        where: {
          department: {
            name: {
              equals: name,
              mode: "insensitive",
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

      const response: BaseResponse<Course[]> = {
        status: "success",
        message: "Courses fetched successfully",
        data: courses,
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
    departmentName: string,
    cycle?: string
  ): Promise<BaseResponse<{ count: number }>> {
    try {
      const result = await db.course.updateMany({
        where: {
          semesterId,
          departmentName,
          approvalStatus: { in: ["DRAFT", "NEEDS_REVISION"] },
          ...(cycle && cycle !== "NONE"
            ? { cycle: cycle as import("@webcampus/db").Cycle }
            : {}),
        },
        data: {
          approvalStatus: "PENDING",
          hasAdminApproved: false,
          hasCoeApproved: false,
          adminNotes: null,
          coeNotes: null,
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

  static async getGroupedCourseSubmissions(role: "admin" | "coe"): Promise<
    BaseResponse<
      Array<{
        id: string;
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
          ...(role === "admin" ? { hasAdminApproved: false } : {}),
          ...(role === "coe" ? { hasCoeApproved: false } : {}),
        },
        include: {
          department: { select: { code: true } },
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
        const key = `${course.departmentName}_${course.semesterId}_${course.cycle}`;
        if (!groupedMap.has(key)) {
          groupedMap.set(key, {
            id: key,
            departmentName: course.departmentName,
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
    departmentName: string,
    cycle?: string,
    role?: "admin" | "coe"
  ): Promise<BaseResponse<{ count: number }>> {
    try {
      if (!role) throw new Error("Role is required for approval");
      // Step 1: Update the role's specific approval flag
      const result = await db.course.updateMany({
        where: {
          semesterId,
          departmentName,
          approvalStatus: "PENDING",
          ...(cycle && cycle !== "NONE"
            ? { cycle: cycle as import("@webcampus/db").Cycle }
            : {}),
        },
        data:
          role === "admin"
            ? { hasAdminApproved: true }
            : { hasCoeApproved: true },
      });

      // Step 2: Check if both are approved, and lock it to APPROVED globally
      await db.course.updateMany({
        where: {
          semesterId,
          departmentName,
          approvalStatus: "PENDING",
          hasAdminApproved: true,
          hasCoeApproved: true,
          ...(cycle && cycle !== "NONE"
            ? { cycle: cycle as import("@webcampus/db").Cycle }
            : {}),
        },
        data: {
          approvalStatus: "APPROVED",
        },
      });

      return {
        status: "success",
        message: `Successfully approved ${result.count} courses`,
        data: { count: result.count },
      };
    } catch (error) {
      logger.error("Failed to approve courses", error);
      throw new Error("Failed to approve courses");
    }
  }

  static async requestRevisionForSemester(
    semesterId: string,
    departmentName: string,
    reviewerNotes: string,
    cycle?: string,
    role?: "admin" | "coe"
  ): Promise<BaseResponse<{ count: number }>> {
    try {
      if (!role) throw new Error("Role is required for requesting revision");
      const result = await db.course.updateMany({
        where: {
          semesterId,
          departmentName,
          approvalStatus: "PENDING",
          ...(cycle && cycle !== "NONE"
            ? { cycle: cycle as import("@webcampus/db").Cycle }
            : {}),
        },
        data: {
          approvalStatus: "NEEDS_REVISION",
          ...(role === "admin"
            ? { adminNotes: reviewerNotes }
            : { coeNotes: reviewerNotes }),
        },
      });

      return {
        status: "success",
        message: `Successfully requested revision for ${result.count} courses`,
        data: { count: result.count },
      };
    } catch (error) {
      logger.error("Failed to request revision for courses", error);
      throw new Error("Failed to request revision for courses");
    }
  }
}
