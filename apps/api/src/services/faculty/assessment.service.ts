import { logger } from "@webcampus/common/logger";
import { Cycle, db } from "@webcampus/db";
import type { CreateAssessmentType } from "@webcampus/schemas/faculty";
import type { BaseResponse } from "@webcampus/types/api";

interface CoordinatedCourseDTO {
  id: string;
  code: string;
  name: string;
  courseMode: string;
  courseType: string;
  totalCredits: number;
  lectureCredits: number;
  tutorialCredits: number;
  practicalCredits: number;
  skillCredits: number;
  semesterNumber: number;
  semesterId: string;
  programType: string;
  departmentName: string;
  departmentAbbreviation: string;
  cieMaxMarks: number;
  maxNoOfCies: number;
  assessments?: { id: string; title: string }[];
}

export class AssessmentService {
  /**
   * Fetch all courses where the given faculty member is designated as a coordinator.
   * Resolves faculty from the userId (session.user.id), not a client-provided facultyId.
   */
  static async getCoordinatedCourses(
    userId: string,
    semesterId?: string,
    cycle?: string
  ): Promise<BaseResponse<CoordinatedCourseDTO[]>> {
    try {
      const faculty = await db.faculty.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!faculty) {
        throw new Error("Faculty profile not found");
      }

      const courses = await db.course.findMany({
        where: {
          coordinators: {
            some: { facultyId: faculty.id },
          },
          ...(semesterId ? { semesterId } : {}),
          ...(cycle ? { cycle: cycle as Cycle } : {}),
        },
        select: {
          id: true,
          code: true,
          name: true,
          courseMode: true,
          courseType: true,
          totalCredits: true,
          lectureCredits: true,
          tutorialCredits: true,
          practicalCredits: true,
          skillCredits: true,
          semesterId: true,
          cieMaxMarks: true,
          maxNoOfCies: true,
          assessments: {
            select: {
              id: true,
              title: true,
            },
          },
          semester: {
            select: {
              semesterNumber: true,
              programType: true,
            },
          },
          department: {
            select: {
              name: true,
              abbreviation: true,
            },
          },
        },
        orderBy: { code: "asc" },
      });

      const data: CoordinatedCourseDTO[] = courses.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        courseMode: c.courseMode,
        courseType: c.courseType,
        totalCredits: c.totalCredits,
        lectureCredits: c.lectureCredits,
        tutorialCredits: c.tutorialCredits,
        practicalCredits: c.practicalCredits,
        skillCredits: c.skillCredits,
        semesterNumber: c.semester.semesterNumber,
        semesterId: c.semesterId,
        programType: c.semester.programType,
        departmentName: c.department.name,
        departmentAbbreviation: c.department.abbreviation,
        cieMaxMarks: c.cieMaxMarks,
        maxNoOfCies: c.maxNoOfCies,
        assessments: c.assessments,
      }));

      return {
        status: "success",
        message: `Found ${data.length} coordinated course(s)`,
        data,
      };
    } catch (error) {
      logger.error("Error fetching coordinated courses", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch coordinated courses");
    }
  }

  /**
   * Create an Assessment Template and its associated Questions using nested writes.
   */
  static async createAssessment(
    userId: string,
    data: CreateAssessmentType
  ): Promise<BaseResponse<null>> {
    try {
      const faculty = await db.faculty.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!faculty) {
        throw new Error("Faculty profile not found");
      }

      const existingAssessment = await db.assessmentTemplate.findFirst({
        where: {
          courseId: data.courseId,
          title: data.title,
        },
      });

      const formattedQuestions = data.questions.map((q) => ({
        part: q.part,
        qNumber: q.qNumber,
        marks: q.marks,
        co: q.co || null,
        po: q.po || null,
        bl: q.bl || null,
        orGroupId: q.orGroupId || null,
      }));

      if (existingAssessment) {
        await db.$transaction([
          db.assessmentQuestion.deleteMany({
            where: { assessmentId: existingAssessment.id },
          }),
          db.assessmentTemplate.update({
            where: { id: existingAssessment.id },
            data: {
              semesterId: data.semesterId,
              totalMarks: data.totalMarks,
              questions: {
                create: formattedQuestions,
              },
            },
          }),
        ]);
      } else {
        await db.assessmentTemplate.create({
          data: {
            courseId: data.courseId,
            semesterId: data.semesterId,
            title: data.title,
            totalMarks: data.totalMarks,
            questions: {
              create: formattedQuestions,
            },
          },
        });
      }

      return {
        status: "success",
        message: "Assessment template saved successfully",
        data: null,
      };
    } catch (error) {
      logger.error("Error creating assessment template", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to create assessment");
    }
  }

  /**
   * Fetch a single Assessment Template with its fully nested questions.
   */
  static async getAssessmentById(
    userId: string,
    assessmentId: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const assessment = await db.assessmentTemplate.findUnique({
        where: { id: assessmentId },
        include: {
          questions: {
            orderBy: [{ part: "asc" }, { qNumber: "asc" }],
          },
          course: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      });

      if (!assessment) {
        throw new Error("Assessment not found");
      }

      // Ensure faculty is actually assigned to this course
      const faculty = await db.faculty.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!faculty) {
        throw new Error("Faculty profile not found");
      }

      const isCoordinator = await db.courseCoordinator.findFirst({
        where: {
          courseId: assessment.courseId,
          facultyId: faculty.id,
        },
      });

      if (!isCoordinator) {
        throw new Error("Unauthorized to view this assessment");
      }

      return {
        status: "success",
        message: "Assessment fetched successfully",
        data: assessment,
      };
    } catch (error) {
      logger.error("Error fetching assessment by ID", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch assessment");
    }
  }
}
