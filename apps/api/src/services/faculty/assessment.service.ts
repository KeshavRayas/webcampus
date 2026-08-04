import { logger } from "@webcampus/common/logger";
import { Cycle, db, Prisma } from "@webcampus/db";
import type { CreateAssessmentType } from "@webcampus/schemas/faculty";
import type { BaseResponse } from "@webcampus/types/api";

export interface CoordinatedCourseDTO {
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

  // ─── NEW CONFIGURATION FIELDS ───
  seeMaxMarks: number;
  seeEligibility: number;
  cieMaxMarks: number;
  cieEligibility: number;
  theoryMaxExams: number;
  theoryExamMaxMarks: number;
  theoryMinExams: number;
  theoryEligibility: number;
  labMaxMarks: number;
  labEligibility: number;
  aatMaxMarks: number;
  aatEligibility: number;

  assessments?: {
    id: string;
    title: string;
    totalMarks: number;
    componentType?: string | null;
    sequence?: number | null;
  }[];
}

export class AssessmentService {
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
          ...(semesterId && { semesterId }),
          ...(cycle && cycle !== "NONE" && { cycle: cycle as Cycle }),
        },
        include: {
          semester: {
            include: { academicTerm: true },
          },
          department: true,
          assessments: {
            select: {
              id: true,
              title: true,
              totalMarks: true,
              componentType: true,
              sequence: true,
            },
          },
        },
        orderBy: { code: "asc" },
      });

      const mappedCourses: CoordinatedCourseDTO[] = courses.map((course) => ({
        id: course.id,
        code: course.code,
        name: course.name,
        courseMode: course.courseMode,
        courseType: course.courseType,
        totalCredits: course.totalCredits,
        lectureCredits: course.lectureCredits,
        tutorialCredits: course.tutorialCredits,
        practicalCredits: course.practicalCredits,
        skillCredits: course.skillCredits,
        semesterNumber: course.semesterNumber,
        semesterId: course.semesterId,
        programType: course.semester.academicTerm.type,
        departmentName: course.department.name,
        departmentAbbreviation: course.department.abbreviation,

        // Include all the new assessment configuration data
        seeMaxMarks: course.seeMaxMarks,
        seeEligibility: course.seeEligibility,
        cieMaxMarks: course.cieMaxMarks,
        cieEligibility: course.cieEligibility,
        theoryMaxExams: course.theoryMaxExams,
        theoryExamMaxMarks: course.theoryExamMaxMarks,
        theoryMinExams: course.theoryMinExams,
        theoryEligibility: course.theoryEligibility,
        labMaxMarks: course.labMaxMarks,
        labEligibility: course.labEligibility,
        aatMaxMarks: course.aatMaxMarks,
        aatEligibility: course.aatEligibility,

        assessments: course.assessments,
      }));

      return {
        status: "success",
        message: "Coordinated courses fetched successfully",
        data: mappedCourses,
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
              title: data.title,
              componentType: data.componentType,
              sequence: data.sequence,
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
            componentType: data.componentType,
            sequence: data.sequence,
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
   * Delete an Assessment Template.
   * Ensures the faculty is a coordinator of the course and no student records exist.
   */
  static async deleteAssessment(
    userId: string,
    assessmentId: string
  ): Promise<BaseResponse<null>> {
    try {
      const faculty = await db.faculty.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!faculty) {
        throw new Error("Faculty profile not found");
      }

      const assessment = await db.assessmentTemplate.findUnique({
        where: { id: assessmentId },
        select: { courseId: true },
      });

      if (!assessment) {
        throw new Error("Assessment not found");
      }

      const isCoordinator = await db.courseCoordinator.findFirst({
        where: {
          courseId: assessment.courseId,
          facultyId: faculty.id,
        },
      });

      if (!isCoordinator) {
        throw new Error("Unauthorized to delete this assessment");
      }

      const hasStudentRecords = await db.studentAssessment.findFirst({
        where: { assessmentId },
        select: { id: true },
      });

      if (hasStudentRecords) {
        throw new Error(
          "Cannot delete this assessment because student marks have already been recorded."
        );
      }

      try {
        await db.assessmentTemplate.delete({ where: { id: assessmentId } });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2003"
        ) {
          throw new Error(
            "Cannot delete this assessment because student marks have already been recorded."
          );
        }
        throw error;
      }

      return {
        status: "success",
        message: "Assessment deleted successfully",
        data: null,
      };
    } catch (error) {
      logger.error("Error deleting assessment", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to delete assessment");
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
