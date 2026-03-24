import { logger } from "@webcampus/common/logger";
import { Course, db, Prisma } from "@webcampus/db";
import {
  CreateCourseDTO,
  UpdateCourseDTO,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";

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
  static async create(data: CreateCourseDTO): Promise<BaseResponse<Course>> {
    try {
      const { departmentName, semesterId, ...courseData } = data;
      const derived = computeDerivedFields(data);

      const course = await db.course.create({
        data: {
          ...courseData,
          ...derived,
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
      const { id, departmentName, semesterId, ...updateFields } = data;

      // Fetch existing course to merge with partial update for derived computation
      const existing = await db.course.findUnique({ where: { id } });
      if (!existing) {
        throw new Error("Course not found");
      }

      const merged: CreateCourseDTO = {
        code: updateFields.code ?? existing.code,
        name: updateFields.name ?? existing.name,
        courseMode: updateFields.courseMode ?? existing.courseMode,
        courseType: updateFields.courseType ?? existing.courseType,
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

      const derived = computeDerivedFields(merged);

      const course = await db.course.update({
        where: { id },
        data: {
          ...updateFields,
          ...derived,
          ...(departmentName
            ? { department: { connect: { name: departmentName } } }
            : {}),
          ...(semesterId ? { semester: { connect: { id: semesterId } } } : {}),
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
      logger.error("Failed to fetch course", error);
      throw error;
    }
  }

  static async getByBranch(
    name: string,
    semesterId?: string
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
}
