import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import {
  AssessmentWithStudentsType,
  CreateMarkType,
  MarkResponseType,
  MarksReportDTO,
  MarksReportFilterOptionsDTO,
  SaveAssessmentMarksType,
  UpdateMarkType,
} from "@webcampus/schemas/faculty";
import { BaseResponse } from "@webcampus/types/api";
import { recomputeStudentMark } from "../shared/mark-sync.service";

export class Mark {
  /**
   * Direct Mark creation — bypasses the assessment aggregate pipeline.
   * Does NOT call recomputeStudentMark, so cieTotal/status here will be
   * OVERWRITTEN the next time saveAssessmentMarks or freeze triggers
   * recomputeStudentMark for this student+course.
   * Prefer saveAssessmentMarks + recomputeStudentMark for normal usage.
   */
  static async create(
    data: CreateMarkType
  ): Promise<BaseResponse<MarkResponseType>> {
    try {
      const existingMark = await db.mark.findUnique({
        where: {
          studentId_courseId: {
            studentId: data.studentId,
            courseId: data.courseId,
          },
        },
      });

      if (existingMark) {
        return {
          status: "error",
          message: "Mark already exists for this student and course",
          error: "Mark already exists for this student and course",
        };
      }

      const mark = await db.mark.create({
        data,
      });

      logger.info("Mark created successfully", { mark });

      return {
        status: "success",
        message: "Mark created successfully",
        data: mark,
      };
    } catch (error) {
      logger.error("Error creating mark:", { error });
      throw new Error("Failed to create mark");
    }
  }

  static async getAll(): Promise<BaseResponse<MarkResponseType[]>> {
    try {
      const marks = await db.mark.findMany();

      return {
        status: "success",
        message: "Marks retrieved successfully",
        data: marks,
      };
    } catch (error) {
      logger.error("Error retrieving marks:", { error });
      throw new Error("Failed to retrieve marks");
    }
  }

  static async getById(id: string): Promise<BaseResponse<MarkResponseType>> {
    try {
      const mark = await db.mark.findUnique({
        where: { id },
      });

      if (!mark) {
        return {
          status: "error",
          message: "Mark not found",
          error: "Mark not found",
        };
      }

      return {
        status: "success",
        message: "Mark retrieved successfully",
        data: mark,
      };
    } catch (error) {
      logger.error("Error retrieving mark:", { error });
      throw new Error("Failed to retrieve mark");
    }
  }

  static async getByStudentAndCourse(
    studentId: string,
    courseId: string
  ): Promise<BaseResponse<MarkResponseType>> {
    try {
      const mark = await db.mark.findUnique({
        where: {
          studentId_courseId: {
            studentId,
            courseId,
          },
        },
      });

      if (!mark) {
        return {
          status: "error",
          message: "Mark not found",
          error: "Mark not found",
        };
      }

      return {
        status: "success",
        message: "Mark retrieved successfully",
        data: mark,
      };
    } catch (error) {
      logger.error("Error retrieving mark:", { error });
      throw new Error("Failed to retrieve mark");
    }
  }

  /**
   * Direct Mark update — bypasses the assessment aggregate pipeline.
   * Does NOT call recomputeStudentMark.  Values set here (cieTotal, status)
   * will be OVERWRITTEN the next time saveAssessmentMarks or freeze triggers
   * recomputeStudentMark for this student+course.
   * The freeze check below mirrors the one in saveAssessmentMarks to prevent
   * manual overrides of frozen data.
   */
  static async update(
    id: string,
    data: UpdateMarkType
  ): Promise<BaseResponse<MarkResponseType>> {
    try {
      const existingMark = await db.mark.findUnique({
        where: { id },
        include: {
          course: {
            include: {
              assignments: {
                include: {
                  freezes: true,
                },
              },
            },
          },
        },
      });

      if (!existingMark) {
        return {
          status: "error",
          message: "Mark not found",
          error: "Mark not found",
        };
      }

      const courseAssignment = existingMark.course.assignments[0];
      const freeze = courseAssignment?.freezes;

      if (freeze?.facultyFrozen || freeze?.hodFrozen || freeze?.adminFrozen) {
        return {
          status: "error",
          message: "Cannot update mark as it has been frozen by HOD or admin",
          error: "Cannot update mark as it has been frozen by HOD or admin",
        };
      }

      const mark = await db.mark.update({
        where: { id },
        data,
      });

      logger.info("Mark updated successfully", { mark });

      return {
        status: "success",
        message: "Mark updated successfully",
        data: mark,
      };
    } catch (error) {
      logger.error("Error updating mark:", { error });
      throw new Error("Failed to update mark");
    }
  }

  static async delete(id: string): Promise<BaseResponse<void>> {
    try {
      const existingMark = await db.mark.findUnique({
        where: { id },
        include: {
          course: {
            include: {
              assignments: {
                include: {
                  freezes: true,
                },
              },
            },
          },
        },
      });

      if (!existingMark) {
        return {
          status: "error",
          message: "Mark not found",
          error: "Mark not found",
        };
      }

      const courseAssignment = existingMark.course.assignments[0];
      const freeze = courseAssignment?.freezes;

      if (freeze?.hodFrozen || freeze?.adminFrozen) {
        return {
          status: "error",
          message: "Cannot delete mark as it has been frozen by HOD or admin",
          error: "Cannot delete mark as it has been frozen by HOD or admin",
        };
      }

      await db.mark.delete({
        where: { id },
      });

      logger.info("Mark deleted successfully", { id });

      return {
        status: "success",
        message: "Mark deleted successfully",
        data: null,
      };
    } catch (error) {
      logger.error("Error deleting mark:", { error });
      throw new Error("Failed to delete mark");
    }
  }

  /**
   * Get marks dashboard: courses where faculty is coordinator + their assessments
   */
  static async getMarksDashboard(
    userId: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const faculty = await db.faculty.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!faculty) {
        throw new Error("Faculty profile not found");
      }

      const assignments = await db.courseAssignment.findMany({
        where: {
          facultyId: faculty.id,
        },
        select: {
          section: {
            select: {
              id: true,
              name: true,
              semesterId: true,
            },
          },
          course: {
            select: {
              id: true,
              code: true,
              name: true,
              semester: {
                select: {
                  id: true,
                  semesterNumber: true,
                  academicTerm: {
                    select: {
                      id: true,
                      type: true,
                      year: true,
                    },
                  },
                },
              },
              assessments: {
                select: {
                  id: true,
                  title: true,
                  totalMarks: true,
                },
              },
            },
          },
        },
        orderBy: { course: { code: "asc" } },
      });

      return {
        status: "success",
        message: "Marks dashboard data retrieved successfully",
        data: assignments,
      };
    } catch (error) {
      logger.error("Error fetching marks dashboard", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch marks dashboard");
    }
  }

  /**
   * Get assessment template with all registered students and their marks
   */
  static async getAssessmentTemplateWithMarks(
    userId: string,
    assessmentId: string,
    sectionId?: string
  ): Promise<BaseResponse<AssessmentWithStudentsType>> {
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
        include: {
          questions: {
            orderBy: [{ part: "asc" }, { qNumber: "asc" }],
          },
          course: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      if (!assessment) {
        throw new Error("Assessment not found");
      }

      // Verify faculty is assigned to this course
      const isAssigned = await db.courseAssignment.findFirst({
        where: {
          courseId: assessment.courseId,
          facultyId: faculty.id,
        },
      });

      if (!isAssigned) {
        throw new Error("Unauthorized to view this assessment");
      }

      // Get students registered for this course, optionally filtered by section
      const courseRegistrations = await db.courseRegistration.findMany({
        where: {
          courseId: assessment.courseId,
          semesterId: assessment.semesterId,
          ...(sectionId
            ? {
                student: {
                  studentSections: {
                    some: { sectionId },
                  },
                },
              }
            : {}),
        },
        include: {
          student: {
            select: {
              id: true,
              usn: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      // Get existing student assessments and marks
      const existingAssessments = await db.studentAssessment.findMany({
        where: {
          assessmentId,
        },
        include: {
          questionMarks: {
            select: {
              questionId: true,
              marksObtained: true,
            },
          },
        },
      });

      const assessmentMap = new Map(
        existingAssessments.map((a) => [a.studentId, a])
      );

      const students = courseRegistrations.map((reg) => {
        const studentAssess = assessmentMap.get(reg.student.id);
        const questionMarks: Record<string, number> = {};
        if (studentAssess?.questionMarks) {
          studentAssess.questionMarks.forEach((qm) => {
            questionMarks[qm.questionId] = qm.marksObtained;
          });
        }
        return {
          studentId: reg.student.id,
          usn: reg.student.usn,
          name: reg.student.user.name,
          totalMarks: studentAssess?.totalMarks ?? 0,
          status: studentAssess?.status ?? "PRESENT",
          questionMarks,
        };
      });

      const result: AssessmentWithStudentsType = {
        id: assessment.id,
        title: assessment.title,
        totalMarks: assessment.totalMarks,
        courseId: assessment.course.id,
        courseName: assessment.course.name,
        courseCode: assessment.course.code,
        questions: assessment.questions.map((q) => ({
          id: q.id,
          part: q.part,
          qNumber: q.qNumber,
          marks: q.marks,
          orGroupId: q.orGroupId,
        })),
        students,
      };

      return {
        status: "success",
        message: "Assessment with students retrieved successfully",
        data: result,
      };
    } catch (error) {
      logger.error("Error fetching assessment with marks", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch assessment with marks");
    }
  }

  /**
   * Save assessment marks (question-by-question) for students
   */
  static async saveAssessmentMarks(
    userId: string,
    data: SaveAssessmentMarksType
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
        where: { id: data.assessmentId },
        include: {
          questions: true,
        },
      });

      if (!assessment) {
        throw new Error("Assessment not found");
      }

      // Verify faculty is assigned to this course
      const isAssigned = await db.courseAssignment.findFirst({
        where: {
          courseId: assessment.courseId,
          facultyId: faculty.id,
        },
      });

      if (!isAssigned) {
        throw new Error("Unauthorized to save marks for this assessment");
      }

      // Check freeze state before allowing marks to be saved
      const freezeRecord = await db.courseAssignment.findFirst({
        where: {
          courseId: assessment.courseId,
          facultyId: faculty.id,
        },
        include: {
          freezes: true,
        },
      });

      const freeze = freezeRecord?.freezes;

      if (
        freeze &&
        (freeze.facultyFrozen || freeze.hodFrozen || freeze.adminFrozen)
      ) {
        throw new Error(
          "Cannot save marks \u2014 marks and attendance have been frozen for this course"
        );
      }

      const hasQuestions = assessment.questions.length > 0;
      const marks = data.marks ?? [];

      // Group question marks by student (only when QP exists)
      const marksByStudent = new Map<string, typeof marks>();
      if (hasQuestions && marks.length > 0) {
        marks.forEach((mark) => {
          if (!marksByStudent.has(mark.studentId)) {
            marksByStudent.set(mark.studentId, []);
          }
          marksByStudent.get(mark.studentId)!.push(mark);
        });
      }

      const totalsByStudent = new Map(
        data.studentTotals.map((entry) => [entry.studentId, entry])
      );

      // Process each student's totals
      for (const [studentId, totalEntry] of totalsByStudent.entries()) {
        // Verify student is registered for this course
        const registration = await db.courseRegistration.findFirst({
          where: {
            studentId,
            courseId: assessment.courseId,
            semesterId: assessment.semesterId,
          },
        });

        if (!registration) {
          logger.warn(`Student ${studentId} not registered for course`, {
            courseId: assessment.courseId,
          });
          continue;
        }

        // Create or update StudentAssessment record
        const studentAssess = await db.studentAssessment.upsert({
          where: {
            studentId_assessmentId: {
              studentId,
              assessmentId: data.assessmentId,
            },
          },
          create: {
            studentId,
            assessmentId: data.assessmentId,
            courseId: data.courseId,
            totalMarks: totalEntry.totalMarks,
            status: totalEntry.status,
          },
          update: {
            totalMarks: totalEntry.totalMarks,
            status: totalEntry.status,
          },
        });

        // Upsert question marks only when QP exists
        if (hasQuestions) {
          const studentMarks = marksByStudent.get(studentId) ?? [];
          for (const mark of studentMarks) {
            await db.studentQuestionMark.upsert({
              where: {
                recordId_questionId: {
                  recordId: studentAssess.id,
                  questionId: mark.questionId,
                },
              },
              create: {
                recordId: studentAssess.id,
                questionId: mark.questionId,
                marksObtained: mark.marksObtained,
              },
              update: {
                marksObtained: mark.marksObtained,
              },
            });
          }
        }
      }

      for (const studentId of totalsByStudent.keys()) {
        await recomputeStudentMark(studentId, data.courseId);
      }

      logger.info("Assessment marks saved successfully", {
        assessmentId: data.assessmentId,
      });

      return {
        status: "success",
        message: "Assessment marks saved successfully",
        data: null,
      };
    } catch (error) {
      logger.error("Error saving assessment marks", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to save assessment marks");
    }
  }

  static async getMarksReport(
    userId: string,
    courseId: string,
    sectionId?: string
  ): Promise<BaseResponse<MarksReportDTO>> {
    try {
      const faculty = await db.faculty.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!faculty) {
        throw new Error("Faculty profile not found");
      }

      const assignment = await db.courseAssignment.findFirst({
        where: {
          courseId,
          facultyId: faculty.id,
        },
        include: {
          course: {
            include: {
              semester: {
                include: {
                  academicTerm: true,
                },
              },
            },
          },
        },
      });

      if (!assignment) {
        throw new Error("Unauthorized to view this course");
      }

      const course = assignment.course;

      const assessments = await db.assessmentTemplate.findMany({
        where: { courseId },
        orderBy: { title: "asc" },
      });

      const registrations = await db.courseRegistration.findMany({
        where: {
          courseId,
          semesterId: course.semesterId,
          ...(sectionId
            ? {
                student: {
                  studentSections: {
                    some: { sectionId },
                  },
                },
              }
            : {}),
        },
        include: {
          student: {
            select: {
              id: true,
              usn: true,
              user: {
                select: { name: true },
              },
            },
          },
        },
      });

      const studentIds = registrations.map((r) => r.student.id);

      const studentAssessments = await db.studentAssessment.findMany({
        where: {
          studentId: { in: studentIds },
          courseId,
        },
      });

      const marksMap = new Map<
        string,
        { cieTotal: number | null; status: string }
      >(
        studentIds.map((id) => [id, { cieTotal: null, status: "NOT_ELIGIBLE" }])
      );

      const markRecords = await db.mark.findMany({
        where: {
          studentId: { in: studentIds },
          courseId,
        },
      });

      for (const mark of markRecords) {
        marksMap.set(mark.studentId, {
          cieTotal: mark.cieTotal,
          status: mark.status,
        });
      }

      const assessmentMap = new Map(
        studentAssessments.map((sa) => [
          `${sa.studentId}_${sa.assessmentId}`,
          sa,
        ])
      );

      const students: MarksReportDTO["students"] = registrations.map((reg) => {
        const markInfo = marksMap.get(reg.student.id) ?? {
          cieTotal: null,
          status: "NOT_ELIGIBLE",
        };

        const assessmentScores = assessments.map((a) => {
          const sa = assessmentMap.get(`${reg.student.id}_${a.id}`);
          return {
            assessmentId: a.id,
            assessmentTitle: a.title,
            totalMarks: sa?.totalMarks ?? null,
            maxMarks: a.totalMarks,
          };
        });

        return {
          usn: reg.student.usn,
          name: reg.student.user.name,
          assessments: assessmentScores,
          cieTotal: markInfo.cieTotal,
          status: markInfo.status,
        };
      });

      const result: MarksReportDTO = {
        course: {
          id: course.id,
          code: course.code,
          name: course.name,
          cumulativeMinMarks: course.cumulativeMinMarks,
        },
        assessments: assessments.map((a) => ({
          id: a.id,
          title: a.title,
          totalMarks: a.totalMarks,
        })),
        semester: {
          id: course.semester.id,
          semesterNumber: course.semester.semesterNumber,
          academicTerm: {
            id: course.semester.academicTerm.id,
            type: course.semester.academicTerm.type,
            year: course.semester.academicTerm.year,
          },
        },
        students,
      };

      return {
        status: "success",
        message: "Marks report retrieved successfully",
        data: result,
      };
    } catch (error) {
      logger.error("Error fetching marks report", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch marks report");
    }
  }

  static async getMarksReportFilterOptions(
    userId: string
  ): Promise<BaseResponse<MarksReportFilterOptionsDTO>> {
    try {
      const faculty = await db.faculty.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!faculty) {
        throw new Error("Faculty profile not found");
      }

      const assignments = await db.courseAssignment.findMany({
        where: { facultyId: faculty.id },
        select: {
          course: {
            select: {
              id: true,
              code: true,
              name: true,
              semesterId: true,
            },
          },
          section: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { course: { code: "asc" } },
      });

      const courses = assignments.map((a) => ({
        id: a.course.id,
        code: a.course.code,
        name: a.course.name,
        sectionId: a.section.id,
        sectionName: a.section.name,
        semesterId: a.course.semesterId,
      }));

      return {
        status: "success",
        message: "Filter options retrieved successfully",
        data: { courses },
      };
    } catch (error) {
      logger.error("Error fetching marks report filter options", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch filter options");
    }
  }
}
