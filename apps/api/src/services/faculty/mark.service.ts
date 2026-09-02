import { isBatchManagedCourse } from "@webcampus/api/src/services/shared/course-kind";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
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
import ExcelJS from "exceljs";
import {
  assertFacultyCourseApproved,
  FACULTY_COURSE_STATUS,
} from "../shared/course-approval";
import {
  resolveActiveRegistration,
  resolveActiveRegistrationsForCourse,
} from "../shared/course-registration-resolver";
import { recomputeStudentMark } from "../shared/mark-sync.service";

export interface ExcelImportError {
  row: number;
  usn: string;
  question: string;
  message: string;
}

export class MarksExcelValidationError extends Error {
  constructor(public readonly errors: ExcelImportError[]) {
    super("Marks upload rejected");
    this.name = "MarksExcelValidationError";
  }
}

type DbLike = Prisma.TransactionClient | typeof db;

const EXCEL_STATUS_LABELS = {
  PRESENT: "Present",
  ABSENT: "Absent",
  MP: "MP",
} as const;

const EXCEL_STATUS_VALUES = ["Present", "Absent", "MP"] as const;

type ExcelStatusValue = keyof typeof EXCEL_STATUS_LABELS;

export function resolveExcelStatus(
  raw: unknown
):
  | { status: ExcelStatusValue; error?: undefined }
  | { status: null; error: string } {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (value === "") return { status: "PRESENT" };
  if (value === "present") return { status: "PRESENT" };
  if (value === "absent") return { status: "ABSENT" };
  if (value === "mp") return { status: "MP" };
  return {
    status: null,
    error: `Invalid Status "${String(raw ?? "").trim()}". Allowed values: ${EXCEL_STATUS_VALUES.join(", ")}.`,
  };
}

export class Mark {
  private static async assertFacultyCanManageMark(
    facultyId: string,
    courseId: string,
    prisma: DbLike = db
  ): Promise<void> {
    const { PeCapacityService } = await import(
      "@webcampus/api/src/services/shared/pe-capacity.service"
    );
    await PeCapacityService.assertPeDownstreamReady(courseId);
    const isAssigned =
      (await prisma.courseAssignment.findFirst({
        where: { courseId, facultyId },
      })) ||
      (await prisma.electiveBatchFaculty.findFirst({
        where: { courseId, facultyId },
      }));
    if (!isAssigned) {
      throw new Error("Unauthorized to manage marks for this course");
    }
  }

  private static async assertFacultyCourseAccess(
    facultyId: string,
    course: { id: string; courseType: string | null },
    prisma: DbLike = db,
    unauthorizedMessage = "Unauthorized to view this assessment"
  ): Promise<"PE" | "PC"> {
    if (isBatchManagedCourse(course.courseType)) {
      const batchFaculty = await prisma.electiveBatchFaculty.findFirst({
        where: { courseId: course.id, facultyId },
      });
      if (!batchFaculty) throw new Error(unauthorizedMessage);
      return "PE";
    }
    const isAssigned = await prisma.courseAssignment.findFirst({
      where: { courseId: course.id, facultyId },
    });
    if (!isAssigned) throw new Error(unauthorizedMessage);
    return "PC";
  }

  private static async getFacultyCourseStudents(
    facultyId: string,
    courseId: string,
    courseType: string | null,
    semesterId: string,
    sectionId: string | undefined,
    prisma: DbLike = db,
    withEmail = false
  ): Promise<
    Array<{
      student: {
        id: string;
        usn: string;
        user: { name: string; email?: string };
      };
    }>
  > {
    if (isBatchManagedCourse(courseType)) {
      const { PeCapacityService } = await import(
        "@webcampus/api/src/services/shared/pe-capacity.service"
      );
      const roster = await PeCapacityService.getFacultyPeRoster(
        facultyId,
        courseId,
        prisma
      );
      const studentIds = roster.map((r) => r.studentId);
      if (studentIds.length === 0) return [];
      const students = await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: {
          id: true,
          usn: true,
          user: {
            select: withEmail ? { name: true, email: true } : { name: true },
          },
        },
      });
      return students.map((s) => ({ student: s }));
    }
    return prisma.courseRegistration.findMany({
      where: {
        courseId,
        semesterId,
        status: "ACTIVE",
        registrationType: { in: ["REGULAR", "RE_REGISTRATION"] },
        ...(sectionId
          ? { student: { studentSections: { some: { sectionId } } } }
          : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            usn: true,
            user: {
              select: withEmail ? { name: true, email: true } : { name: true },
            },
          },
        },
      },
      orderBy: { student: { usn: "asc" } },
    });
  }

  /**
   * Narrows a faculty roster to the students assigned to one specific
   * elective batch of a batch-managed (PE/OE) course. The faculty roster
   * remains the source of truth for ownership; the batch only filters it.
   */
  private static async scopeRosterToElectiveBatch<
    T extends { student: { id: string } },
  >(roster: T[], courseId: string, electiveBatchId: string): Promise<T[]> {
    const batchAssignments = await db.electiveStudentAssignment.findMany({
      where: { courseId, electiveBatchId },
      select: { studentId: true },
    });
    const batchStudentIds = new Set(
      batchAssignments.map((assignment) => assignment.studentId)
    );
    return roster.filter((row) => batchStudentIds.has(row.student.id));
  }

  /**
   * Direct Mark creation — bypasses the assessment aggregate pipeline.
   * Does NOT call recomputeStudentMark, so cieTotal/status here will be
   * OVERWRITTEN the next time saveAssessmentMarks or freeze triggers
   * recomputeStudentMark for this student+course.
   * Prefer saveAssessmentMarks + recomputeStudentMark for normal usage.
   */
  static async create(
    data: CreateMarkType,
    userId: string
  ): Promise<BaseResponse<MarkResponseType>> {
    try {
      const faculty = await db.faculty.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!faculty) {
        throw new Error("Faculty profile not found");
      }

      const registration = await resolveActiveRegistration({
        studentId: data.studentId,
        courseId: data.courseId,
      });

      const existingMark = await db.mark.findFirst({
        where: {
          studentId: data.studentId,
          courseId: data.courseId,
          courseRegistrationId: registration?.id ?? null,
        },
      });

      if (existingMark) {
        return {
          status: "error",
          message: "Mark already exists for this student and course",
          error: "Mark already exists for this student and course",
        };
      }

      await this.assertFacultyCanManageMark(faculty.id, data.courseId);

      const mark = await db.mark.create({
        data: {
          ...data,
          courseRegistrationId: registration?.id,
        },
      });

      logger.info("Mark created successfully", { mark });

      return {
        status: "success",
        message: "Mark created successfully",
        data: mark,
      };
    } catch (error) {
      logger.error("Error creating mark:", { error });
      if (error instanceof Error) throw error;
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
      const registration = await resolveActiveRegistration({
        studentId,
        courseId,
      });
      const mark = registration
        ? ((await db.mark.findFirst({
            where: {
              studentId,
              courseId,
              courseRegistrationId: registration.id,
            },
          })) ??
          (await db.mark.findFirst({
            where: { studentId, courseId, courseRegistrationId: null },
          })))
        : await db.mark.findFirst({
            where: { studentId, courseId },
            orderBy: { id: "desc" },
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
    data: UpdateMarkType,
    userId: string
  ): Promise<BaseResponse<MarkResponseType>> {
    try {
      const faculty = await db.faculty.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!faculty) {
        throw new Error("Faculty profile not found");
      }

      const existingMark = await db.mark.findUnique({
        where: { id },
        select: {
          id: true,
          courseId: true,
          course: {
            select: {
              approvalStatus: true,
              assignments: {
                select: {
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

      assertFacultyCourseApproved(existingMark.course.approvalStatus, true);

      const courseAssignment = existingMark.course.assignments[0];
      const freeze = courseAssignment?.freezes;

      if (freeze?.facultyFrozen || freeze?.hodFrozen || freeze?.adminFrozen) {
        return {
          status: "error",
          message: "Cannot update mark as it has been frozen by HOD or admin",
          error: "Cannot update mark as it has been frozen by HOD or admin",
        };
      }

      await this.assertFacultyCanManageMark(faculty.id, existingMark.courseId);

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
      if (error instanceof Error) throw error;
      throw new Error("Failed to update mark");
    }
  }

  static async delete(id: string, userId: string): Promise<BaseResponse<void>> {
    try {
      const faculty = await db.faculty.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!faculty) {
        throw new Error("Faculty profile not found");
      }

      const existingMark = await db.mark.findUnique({
        where: { id },
        select: {
          id: true,
          courseId: true,
          course: {
            select: {
              approvalStatus: true,
              assignments: {
                select: {
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

      assertFacultyCourseApproved(existingMark.course.approvalStatus, true);

      const courseAssignment = existingMark.course.assignments[0];
      const freeze = courseAssignment?.freezes;

      if (freeze?.hodFrozen || freeze?.adminFrozen) {
        return {
          status: "error",
          message: "Cannot delete mark as it has been frozen by HOD or admin",
          error: "Cannot delete mark as it has been frozen by HOD or admin",
        };
      }

      await this.assertFacultyCanManageMark(faculty.id, existingMark.courseId);

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
      if (error instanceof Error) throw error;
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
          course: { approvalStatus: FACULTY_COURSE_STATUS },
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
              courseType: true,
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
                  studentRecords: {
                    select: { id: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
        orderBy: { course: { code: "asc" } },
      });

      const formattedAssignments = assignments.map((assignment) => ({
        ...assignment,
        electiveBatchId: null,
        electiveBatchName: null,
        course: {
          ...assignment.course,
          assessments: assignment.course.assessments.map((assessment) => ({
            id: assessment.id,
            title: assessment.title,
            totalMarks: assessment.totalMarks,
            hasMarks: assessment.studentRecords.length > 0,
          })),
        },
      }));

      const peAssignments = await db.electiveBatchFaculty.findMany({
        where: {
          facultyId: faculty.id,
          course: { approvalStatus: FACULTY_COURSE_STATUS },
        },
        select: {
          electiveBatch: {
            select: {
              id: true,
              name: true,
            },
          },
          course: {
            select: {
              id: true,
              code: true,
              name: true,
              courseType: true,
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
                  studentRecords: {
                    select: { id: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      const formattedPeAssignments = peAssignments.map((assignment) => ({
        section: null,
        electiveBatchId: assignment.electiveBatch?.id ?? null,
        electiveBatchName: assignment.electiveBatch?.name ?? null,
        course: {
          ...assignment.course,
          assessments: assignment.course.assessments.map((assessment) => ({
            id: assessment.id,
            title: assessment.title,
            totalMarks: assessment.totalMarks,
            hasMarks: assessment.studentRecords.length > 0,
          })),
        },
      }));

      return {
        status: "success",
        message: "Marks dashboard data retrieved successfully",
        data: [...formattedAssignments, ...formattedPeAssignments].sort(
          (a, b) => a.course.code.localeCompare(b.course.code)
        ),
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
    sectionId?: string,
    electiveBatchId?: string
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
              courseType: true,
              approvalStatus: true,
            },
          },
        },
      });

      if (!assessment) {
        throw new Error("Assessment not found");
      }

      assertFacultyCourseApproved(assessment.course.approvalStatus);

      // Verify faculty is assigned to this course (PC section mapping or PE elective batch)
      await this.assertFacultyCourseAccess(faculty.id, assessment.course, db);

      // Get students for this course, scoped to the faculty (PC section or PE batch roster)
      const courseStudents = await this.getFacultyCourseStudents(
        faculty.id,
        assessment.courseId,
        assessment.course.courseType,
        assessment.semesterId,
        sectionId,
        db,
        false
      );

      // Narrow the roster to a single elective batch when one is selected
      const scopedStudents = electiveBatchId
        ? await this.scopeRosterToElectiveBatch(
            courseStudents,
            assessment.courseId,
            electiveBatchId
          )
        : courseStudents;

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

      const students = scopedStudents.map((reg) => {
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
    data: SaveAssessmentMarksType,
    tx?: Prisma.TransactionClient
  ): Promise<BaseResponse<null>> {
    const prisma: DbLike = tx ?? db;
    try {
      const faculty = await prisma.faculty.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!faculty) {
        throw new Error("Faculty profile not found");
      }

      const assessment = await prisma.assessmentTemplate.findUnique({
        where: { id: data.assessmentId },
        include: {
          questions: true,
          course: { select: { approvalStatus: true, courseType: true } },
        },
      });

      if (!assessment) {
        throw new Error("Assessment not found");
      }

      assertFacultyCourseApproved(assessment.course.approvalStatus, true);

      const { PeCapacityService } = await import(
        "@webcampus/api/src/services/shared/pe-capacity.service"
      );
      await PeCapacityService.assertPeDownstreamReady(assessment.courseId);

      // Verify faculty is assigned to this course (PC section mapping or PE elective batch)
      await this.assertFacultyCourseAccess(
        faculty.id,
        { id: assessment.courseId, courseType: assessment.course.courseType },
        prisma,
        "Unauthorized to save marks for this assessment"
      );

      // PE/OE faculty may only save marks for students in their own elective batches
      const isBatchManaged = isBatchManagedCourse(assessment.course.courseType);
      const allowedPeStudentIds = isBatchManaged
        ? new Set(
            (
              await PeCapacityService.getFacultyPeRoster(
                faculty.id,
                assessment.courseId,
                prisma
              )
            ).map((r) => r.studentId)
          )
        : null;

      // Check freeze state before allowing marks to be saved
      const freezeRecord = await prisma.courseAssignment.findFirst({
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
      const studentIds = [...totalsByStudent.keys()];

      // K3: pin every CIE write to the student's active attempt in the
      // course's home semester (REGULAR / RE_REGISTRATION only). Anchored by
      // semesterId — cross-term re-registrations carry their original
      // semester, so backlog attempts resolve here. Resolved in one batched
      // query for the whole upload.
      const registrationByStudent = await resolveActiveRegistrationsForCourse(
        {
          courseId: assessment.courseId,
          studentIds,
          semesterId: assessment.semesterId,
        },
        tx
      );

      const registrationPinByStudent = new Map<string, string>();
      for (const [studentId, totalEntry] of totalsByStudent.entries()) {
        // PE/OE faculty may only mark students within their elective batches
        if (isBatchManaged) {
          if (!allowedPeStudentIds?.has(studentId)) {
            throw new Error(
              `Student ${studentId} is not in any of your elective batches for this course`
            );
          }
        }

        const registration = registrationByStudent.get(studentId) ?? null;

        if (!registration) {
          logger.warn(
            `Student ${studentId} has no active registration for course`,
            {
              courseId: assessment.courseId,
              semesterId: assessment.semesterId,
            }
          );
          continue;
        }

        registrationPinByStudent.set(studentId, registration.id);

        // Attempt-scoped StudentAssessment row: one per (student, assessment,
        // registration). Never touches a legacy null-pinned row or another
        // attempt's row.
        const attemptAssessment = await prisma.studentAssessment.findFirst({
          where: {
            studentId,
            assessmentId: data.assessmentId,
            courseRegistrationId: registration.id,
          },
          select: { id: true },
        });

        const studentAssess = attemptAssessment
          ? await prisma.studentAssessment.update({
              where: { id: attemptAssessment.id },
              data: {
                totalMarks: totalEntry.totalMarks,
                status: totalEntry.status,
              },
            })
          : await prisma.studentAssessment.create({
              data: {
                studentId,
                assessmentId: data.assessmentId,
                courseId: data.courseId,
                totalMarks: totalEntry.totalMarks,
                status: totalEntry.status,
                courseRegistrationId: registration.id,
              },
            });

        // Upsert question marks only when QP exists
        if (hasQuestions) {
          const studentMarks = marksByStudent.get(studentId) ?? [];
          for (const mark of studentMarks) {
            await prisma.studentQuestionMark.upsert({
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

      for (const [
        studentId,
        courseRegistrationId,
      ] of registrationPinByStudent) {
        await recomputeStudentMark(studentId, data.courseId, tx, {
          semesterId: assessment.semesterId,
          courseRegistrationId,
        });
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

  static async generateMarksTemplate(
    userId: string,
    assessmentId: string,
    sectionId?: string,
    electiveBatchId?: string
  ): Promise<Buffer> {
    const faculty = await db.faculty.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!faculty) throw new Error("Faculty profile not found");

    const assessment = await db.assessmentTemplate.findUnique({
      where: { id: assessmentId },
      include: {
        questions: { orderBy: [{ part: "asc" }, { qNumber: "asc" }] },
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            courseType: true,
            approvalStatus: true,
            semester: {
              select: {
                id: true,
                semesterNumber: true,
                academicTerm: { select: { type: true, year: true } },
              },
            },
          },
        },
      },
    });
    if (!assessment) throw new Error("Assessment not found");

    assertFacultyCourseApproved(assessment.course.approvalStatus);

    await this.assertFacultyCourseAccess(faculty.id, assessment.course, db);

    const roster = await this.getFacultyCourseStudents(
      faculty.id,
      assessment.courseId,
      assessment.course.courseType,
      assessment.semesterId,
      sectionId,
      db,
      true
    );

    const scopedRoster = electiveBatchId
      ? await this.scopeRosterToElectiveBatch(
          roster,
          assessment.courseId,
          electiveBatchId
        )
      : roster;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Marks Entry");

    worksheet.addRow([
      "Academic Term",
      `${assessment.course.semester.academicTerm.type} ${assessment.course.semester.academicTerm.year}`,
    ]);
    worksheet.addRow(["Semester", assessment.course.semester.semesterNumber]);
    worksheet.addRow(["Course", assessment.course.name]);
    worksheet.addRow(["Course Code", assessment.course.code]);
    worksheet.addRow(["Assessment", assessment.title]);
    worksheet.addRow(["Max Marks", assessment.totalMarks]);
    worksheet.addRow([]);

    const headerRow = worksheet.addRow([
      "USN",
      "Student Name",
      "Student Email",
      "Status",
      ...assessment.questions.map((q) => q.qNumber),
    ]);
    headerRow.font = { bold: true };

    scopedRoster.forEach((reg) => {
      const rosterRow = worksheet.addRow([
        reg.student.usn,
        reg.student.user.name,
        reg.student.user.email,
        EXCEL_STATUS_LABELS.PRESENT,
        ...assessment.questions.map(() => ""),
      ]);
      rosterRow.getCell(4).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${EXCEL_STATUS_VALUES.join(",")}"`],
      };
    });

    worksheet.getColumn(1).width = 18;
    worksheet.getColumn(2).width = 30;
    worksheet.getColumn(3).width = 30;
    worksheet.getColumn(4).width = 12;
    assessment.questions.forEach((_, index) => {
      worksheet.getColumn(index + 5).width = 10;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  private static computeTotalWithOrLogic(
    questions: Array<{
      id: string;
      part: string;
      marks: number;
      orGroupId: string | null;
    }>,
    marks: Record<string, number>
  ): number {
    const byPart = new Map<string, typeof questions>();
    questions.forEach((q) => {
      const list = byPart.get(q.part) ?? [];
      list.push(q);
      byPart.set(q.part, list);
    });

    let total = 0;
    byPart.forEach((partQuestions) => {
      const orMaxes = new Map<string, number>();
      let standalone = 0;
      partQuestions.forEach((q) => {
        const obtained = marks[q.id] ?? 0;
        if (q.orGroupId) {
          orMaxes.set(
            q.orGroupId,
            Math.max(orMaxes.get(q.orGroupId) ?? 0, obtained)
          );
        } else {
          standalone += obtained;
        }
      });

      let orSum = 0;
      orMaxes.forEach((max) => {
        orSum += max;
      });
      total += standalone + orSum;
    });

    return total;
  }

  static async uploadMarksFromExcel(
    userId: string,
    assessmentId: string,
    sectionId: string | undefined,
    electiveBatchId: string | undefined,
    fileBuffer: Buffer
  ): Promise<BaseResponse<null>> {
    const faculty = await db.faculty.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!faculty) throw new Error("Faculty profile not found");

    const assessment = await db.assessmentTemplate.findUnique({
      where: { id: assessmentId },
      include: {
        questions: { orderBy: [{ part: "asc" }, { qNumber: "asc" }] },
        course: { select: { id: true, courseType: true } },
      },
    });
    if (!assessment) throw new Error("Assessment not found");

    await this.assertFacultyCourseAccess(
      faculty.id,
      assessment.course,
      db,
      "Unauthorized to upload marks for this assessment"
    );

    const isBatchManaged = isBatchManagedCourse(assessment.course.courseType);
    const facultyRoster = await this.getFacultyCourseStudents(
      faculty.id,
      assessment.courseId,
      assessment.course.courseType,
      assessment.semesterId,
      sectionId,
      db,
      false
    );
    const roster = electiveBatchId
      ? await this.scopeRosterToElectiveBatch(
          facultyRoster,
          assessment.courseId,
          electiveBatchId
        )
      : facultyRoster;
    const studentIdByUsn = new Map(
      roster.map((r) => [r.student.usn, r.student.id])
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new Error("Invalid Excel file format");

    let headerRowNumber = -1;
    worksheet.eachRow((row, rowNumber) => {
      if (
        headerRowNumber === -1 &&
        row.getCell(1).text.trim().toUpperCase() === "USN"
      ) {
        headerRowNumber = rowNumber;
      }
    });
    if (headerRowNumber === -1) {
      throw new Error(
        "Template header row (USN) not found in the uploaded file"
      );
    }

    const headerRow = worksheet.getRow(headerRowNumber);
    const columnByHeader = new Map<string, number>();
    headerRow.eachCell((cell, colNumber) => {
      const header = cell.text.trim();
      if (header) columnByHeader.set(header, colNumber);
    });

    const statusColumns = [...columnByHeader.entries()].filter(
      ([header]) => header.trim().toLowerCase() === "status"
    );
    if (statusColumns.length > 1) {
      throw new MarksExcelValidationError([
        {
          row: headerRowNumber,
          usn: "-",
          question: "Status",
          message: `Invalid template: found ${statusColumns.length} Status columns. Keep exactly one "Status" column.`,
        },
      ]);
    }
    const statusColumnIndex: number | undefined = statusColumns[0]?.[1];

    const missingColumns = assessment.questions.filter(
      (q) => !columnByHeader.has(q.qNumber)
    );
    if (missingColumns.length > 0) {
      throw new MarksExcelValidationError(
        missingColumns.map((q) => ({
          row: headerRowNumber,
          usn: "-",
          question: q.qNumber,
          message: "Missing question column in template",
        }))
      );
    }

    const errors: ExcelImportError[] = [];
    const seenUsns = new Set<string>();
    const parsed: Array<{
      studentId: string;
      status: "PRESENT" | "ABSENT" | "MP";
      marks: Array<{ questionId: string; marksObtained: number }>;
    }> = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return;
      const usn = row.getCell(1).text.trim();
      if (!usn) return;

      const studentId = studentIdByUsn.get(usn);
      if (!studentId) {
        errors.push({
          row: rowNumber,
          usn,
          question: "-",
          message: isBatchManaged
            ? "Student not found in your elective batches"
            : "Student not found in the selected section",
        });
        return;
      }
      if (seenUsns.has(usn)) {
        errors.push({
          row: rowNumber,
          usn,
          question: "-",
          message: "Duplicate USN in file",
        });
        return;
      }
      seenUsns.add(usn);

      const rawStatus =
        statusColumnIndex != null ? row.getCell(statusColumnIndex).text : "";
      const resolved = resolveExcelStatus(rawStatus);
      if (resolved.status === null) {
        errors.push({
          row: rowNumber,
          usn,
          question: "Status",
          message: `Row ${rowNumber}: ${resolved.error}`,
        });
        return;
      }
      const status = resolved.status;

      const marks: Array<{ questionId: string; marksObtained: number }> = [];
      if (status === "PRESENT") {
        assessment.questions.forEach((q) => {
          const colNumber = columnByHeader.get(q.qNumber);
          const raw = colNumber ? row.getCell(colNumber).text.trim() : "";
          if (raw === "") {
            marks.push({ questionId: q.id, marksObtained: 0 });
            return;
          }

          const num = Number(raw);
          if (Number.isNaN(num) || !Number.isFinite(num)) {
            errors.push({
              row: rowNumber,
              usn,
              question: q.qNumber,
              message: "Marks must be numeric",
            });
            return;
          }
          if (num < 0 || num > q.marks) {
            errors.push({
              row: rowNumber,
              usn,
              question: q.qNumber,
              message: `Marks ${num} exceed maximum ${q.marks}`,
            });
            return;
          }
          marks.push({ questionId: q.id, marksObtained: num });
        });
      }

      parsed.push({ studentId, status, marks });
    });

    if (errors.length > 0) {
      throw new MarksExcelValidationError(errors);
    }

    const studentTotals = parsed.map((entry) => {
      const marksRecord: Record<string, number> = {};
      entry.marks.forEach((mark) => {
        marksRecord[mark.questionId] = mark.marksObtained;
      });
      return {
        studentId: entry.studentId,
        totalMarks:
          entry.status === "PRESENT"
            ? Mark.computeTotalWithOrLogic(assessment.questions, marksRecord)
            : 0,
        status: entry.status,
      };
    });

    const marks = parsed.flatMap((entry) =>
      entry.status === "PRESENT"
        ? entry.marks.map((mark) => ({
            studentId: entry.studentId,
            questionId: mark.questionId,
            marksObtained: mark.marksObtained,
          }))
        : []
    );

    const absentMpStudentIds = parsed
      .filter((entry) => entry.status !== "PRESENT")
      .map((entry) => entry.studentId);

    return db.$transaction(async (tx) => {
      if (absentMpStudentIds.length > 0) {
        const records = await tx.studentAssessment.findMany({
          where: { assessmentId, studentId: { in: absentMpStudentIds } },
          select: { id: true },
        });
        if (records.length > 0) {
          await tx.studentQuestionMark.deleteMany({
            where: { recordId: { in: records.map((r) => r.id) } },
          });
        }
      }
      return Mark.saveAssessmentMarks(
        userId,
        {
          assessmentId,
          courseId: assessment.courseId,
          marks,
          studentTotals,
        },
        tx
      );
    });
  }

  static async getMarksReport(
    userId: string,
    courseId: string,
    sectionId?: string,
    assessmentId?: string,
    detailed?: boolean
  ): Promise<BaseResponse<MarksReportDTO>> {
    try {
      const faculty = await db.faculty.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!faculty) {
        throw new Error("Faculty profile not found");
      }

      const courseTypeRow = await db.course.findUnique({
        where: { id: courseId },
        select: { courseType: true },
      });

      const isBatchManaged = isBatchManagedCourse(courseTypeRow?.courseType);

      const courseInclude = {
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            semesterId: true,
            cieEligibility: true,
            cieMaxMarks: true,
            approvalStatus: true,
            semester: {
              include: {
                academicTerm: true,
              },
            },
          },
        },
      } as const;

      const assignment = isBatchManaged
        ? await db.electiveBatchFaculty.findFirst({
            where: {
              courseId,
              facultyId: faculty.id,
              course: { approvalStatus: FACULTY_COURSE_STATUS },
            },
            include: courseInclude,
          })
        : await db.courseAssignment.findFirst({
            where: {
              courseId,
              facultyId: faculty.id,
              course: { approvalStatus: FACULTY_COURSE_STATUS },
            },
            include: courseInclude,
          });

      if (!assignment) {
        throw new Error("Unauthorized to view this course");
      }

      const course = assignment.course;

      assertFacultyCourseApproved(course.approvalStatus);

      const assessments = await db.assessmentTemplate.findMany({
        where: {
          courseId,
          ...(assessmentId ? { id: assessmentId } : {}),
        },
        include: detailed
          ? {
              questions: {
                orderBy: [{ part: "asc" }, { qNumber: "asc" }],
              },
            }
          : undefined,
        orderBy: { title: "asc" },
      });

      const registrations = await this.getFacultyCourseStudents(
        faculty.id,
        courseId,
        isBatchManaged ? (courseTypeRow?.courseType ?? "PE") : null,
        course.semesterId,
        sectionId,
        db,
        false
      );

      let roster = registrations;
      if (isBatchManaged && sectionId) {
        const ownedBatch = await db.electiveBatchFaculty.findFirst({
          where: {
            courseId,
            facultyId: faculty.id,
            electiveBatchId: sectionId,
            course: { approvalStatus: FACULTY_COURSE_STATUS },
          },
          select: { id: true },
        });

        if (!ownedBatch) {
          throw new Error(
            "Selected batch is not assigned to this faculty for this course"
          );
        }

        const batchStudents = await db.electiveStudentAssignment.findMany({
          where: { courseId, electiveBatchId: sectionId },
          select: { studentId: true },
        });
        const batchStudentIds = new Set(batchStudents.map((s) => s.studentId));
        roster = registrations.filter((r) => batchStudentIds.has(r.student.id));
      }

      const studentIds = roster.map((r) => r.student.id);

      const studentAssessments = await db.studentAssessment.findMany({
        where: {
          studentId: { in: studentIds },
          courseId,
        },
        include: detailed
          ? {
              questionMarks: true,
            }
          : undefined,
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

      const students: MarksReportDTO["students"] = roster.map((reg) => {
        const markInfo = marksMap.get(reg.student.id) ?? {
          cieTotal: null,
          status: "NOT_ELIGIBLE",
        };

        const assessmentScores = assessments.map((a) => {
          const sa = assessmentMap.get(`${reg.student.id}_${a.id}`);
          let questionMarks: Record<string, number> | undefined;

          if (detailed && sa && "questionMarks" in sa) {
            questionMarks = {};
            const qms = sa.questionMarks as {
              questionId: string;
              marksObtained: number;
            }[];
            for (const qm of qms) {
              questionMarks[qm.questionId] = qm.marksObtained;
            }
          }

          return {
            assessmentId: a.id,
            assessmentTitle: a.title,
            totalMarks: sa?.totalMarks ?? null,
            maxMarks: a.totalMarks,
            questionMarks,
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
          cieMinMarks: (course.cieEligibility / 100) * course.cieMaxMarks,
          cieEligibilityPercent: course.cieEligibility,
        },
        assessments: assessments.map((a) => ({
          id: a.id,
          title: a.title,
          totalMarks: a.totalMarks,
          componentType: a.componentType,
          questions:
            detailed && "questions" in a
              ? (
                  a.questions as {
                    id: string;
                    part: string | null;
                    qNumber: number;
                    marks: number;
                  }[]
                ).map((q) => ({
                  id: q.id,
                  part: q.part ?? "",
                  qNumber: String(q.qNumber),
                  marks: q.marks,
                }))
              : undefined,
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
        where: {
          facultyId: faculty.id,
          course: { approvalStatus: FACULTY_COURSE_STATUS },
        },
        select: {
          course: {
            select: {
              id: true,
              code: true,
              name: true,
              courseType: true,
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
        courseType: a.course.courseType,
        sectionId: a.section.id,
        sectionName: a.section.name,
        semesterId: a.course.semesterId,
        isElectiveBatch: false,
      }));

      const peAssignments = await db.electiveBatchFaculty.findMany({
        where: {
          facultyId: faculty.id,
          course: { approvalStatus: FACULTY_COURSE_STATUS },
        },
        select: {
          course: {
            select: {
              id: true,
              code: true,
              name: true,
              courseType: true,
              semesterId: true,
            },
          },
          electiveBatch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const peCourseRows = peAssignments.map((a) => ({
        id: a.course.id,
        code: a.course.code,
        name: a.course.name,
        courseType: a.course.courseType,
        semesterId: a.course.semesterId,
        sectionId: a.electiveBatch.id,
        sectionName: a.electiveBatch.name,
        isElectiveBatch: true,
      }));

      const allCourses = [...courses, ...peCourseRows];
      const courseIds = [...new Set(allCourses.map((c) => c.id))];
      const assessmentsRaw = await db.assessmentTemplate.findMany({
        where: { courseId: { in: courseIds } },
        select: { id: true, title: true, courseId: true },
        orderBy: { title: "asc" },
      });

      return {
        status: "success",
        message: "Filter options retrieved successfully",
        data: { courses: allCourses, assessments: assessmentsRaw },
      };
    } catch (error) {
      logger.error("Error fetching marks report filter options", error);
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch filter options");
    }
  }
}
