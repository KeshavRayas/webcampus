import { db } from "@webcampus/db";
import type {
  CourseDistributionQuery,
  FeedbackPresetInput,
  FeedbackReportQuery,
  FeedbackRoundInput,
  FeedbackRoundUpdateInput,
  FeedbackSubmissionInput,
  FeedbackTermConfigurationInput,
} from "@webcampus/schemas/feedback";
import { FACULTY_COURSE_STATUS } from "./course-approval";
import { isBatchManagedCourse } from "./course-kind";
import type { FeedbackScope } from "./feedback-scope.service";

const FEEDBACK_SCORE_LABELS = {
  5: "Excellent",
  4: "Very Good",
  3: "Good",
  2: "Fair",
  1: "Poor",
} as const;

const toRoman = (num: number) => {
  const roman: Record<string, number> = {
    M: 1000,
    CM: 900,
    D: 500,
    CD: 400,
    C: 100,
    XC: 90,
    L: 50,
    XL: 40,
    X: 10,
    IX: 9,
    V: 5,
    IV: 4,
    I: 1,
  };
  let str = "";
  for (const [key, value] of Object.entries(roman)) {
    const q = Math.floor(num / value);
    num -= q * value;
    str += key.repeat(q);
  }
  return str;
};

const roundIsVisible = (round: { isEnabled: boolean; endsAt: Date }) =>
  !round.isEnabled || new Date() > round.endsAt;

export const roundStatus = (
  round: { isEnabled: boolean; startsAt: Date; endsAt: Date },
  now = new Date()
): "DISABLED" | "UPCOMING" | "ONGOING" | "COMPLETED" =>
  !round.isEnabled
    ? "DISABLED"
    : now < round.startsAt
      ? "UPCOMING"
      : now > round.endsAt
        ? "COMPLETED"
        : "ONGOING";

export const assertExactlyOneFeedbackOwnership = (input: {
  courseAssignmentId?: string | null;
  electiveBatchFacultyId?: string | null;
}): void => {
  const hasPc = Boolean(input.courseAssignmentId);
  const hasElective = Boolean(input.electiveBatchFacultyId);
  if (hasPc === hasElective) {
    throw new Error(
      "Feedback must reference exactly one ownership path (courseAssignmentId XOR electiveBatchFacultyId)."
    );
  }
};

export class FeedbackService {
  static async getStudentFeedback(userId: string) {
    const student = await db.student.findUnique({
      where: { userId },
      select: {
        id: true,
        semesterId: true,
        academicTermId: true,
        studentSections: { select: { sectionId: true } },
      },
    });

    if (!student?.semesterId || !student.academicTermId) {
      throw new Error("Student academic context is incomplete");
    }

    const rounds = await db.feedbackRound.findMany({
      where: {
        semesterId: student.semesterId,
        academicTermId: student.academicTermId,
      },
      include: {
        questionSet: {
          include: { questions: { orderBy: { questionNumber: "asc" } } },
        },
      },
      orderBy: { roundNumber: "asc" },
    });

    const assignments = await db.courseAssignment.findMany({
      where: {
        sectionId: {
          in: student.studentSections.map((section) => section.sectionId),
        },
        section: { semesterId: student.semesterId },
        course: {
          allowFeedback: true,
          registrations: {
            some: {
              studentId: student.id,
              semesterId: student.semesterId,
              academicTermId: student.academicTermId,
              status: "ACTIVE",
              registrationType: { in: ["REGULAR", "RE_REGISTRATION"] },
            },
          },
        },
      },
      include: {
        course: { select: { id: true, code: true, name: true } },
        faculty: {
          select: {
            id: true,
            shortName: true,
            user: { select: { name: true } },
          },
        },
        section: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true } },
        feedbackResponses: {
          where: { studentId: student.id },
          select: { feedbackRoundId: true, submittedAt: true },
        },
      },
      orderBy: [{ course: { code: "asc" } }, { assignmentType: "asc" }],
    });

    const electiveAssignments = await db.electiveBatchFaculty.findMany({
      where: {
        electiveBatch: {
          studentAssignments: { some: { studentId: student.id } },
        },
        course: {
          allowFeedback: true,
          approvalStatus: FACULTY_COURSE_STATUS,
          semesterId: student.semesterId,
        },
      },
      include: {
        course: { select: { id: true, code: true, name: true } },
        faculty: {
          select: {
            id: true,
            shortName: true,
            user: { select: { name: true } },
          },
        },
        electiveBatch: { select: { id: true, name: true } },
        feedbackResponses: {
          where: { studentId: student.id },
          select: { feedbackRoundId: true, submittedAt: true },
        },
      },
      orderBy: { course: { code: "asc" } },
    });

    const electiveRows = electiveAssignments.map((assignment) => ({
      id: assignment.id,
      electiveBatchFacultyId: assignment.id,
      assignmentType: "THEORY",
      course: assignment.course,
      faculty: assignment.faculty,
      section: {
        id: assignment.electiveBatch.id,
        name: assignment.electiveBatch.name,
      },
      batch: null,
      submissions: assignment.feedbackResponses,
    }));

    return {
      rounds: rounds.map((round) => ({
        id: round.id,
        roundNumber: round.roundNumber,
        name: round.name,
        startsAt: round.startsAt,
        endsAt: round.endsAt,
        isEnabled: round.isEnabled,
        isActive:
          round.isEnabled &&
          new Date() >= round.startsAt &&
          new Date() <= round.endsAt,
        questions: round.questionSet.questions,
      })),
      assignments: [
        ...electiveRows,
        ...assignments.map((assignment) => ({
          id: assignment.id,
          assignmentType: assignment.assignmentType,
          course: assignment.course,
          faculty: assignment.faculty,
          section: assignment.section,
          batch: assignment.batch,
          submissions: assignment.feedbackResponses,
        })),
      ],
    };
  }

  static async submitStudentFeedback(
    userId: string,
    input: FeedbackSubmissionInput
  ) {
    assertExactlyOneFeedbackOwnership({
      courseAssignmentId: input.courseAssignmentId,
      electiveBatchFacultyId: input.electiveBatchFacultyId,
    });

    const student = await db.student.findUnique({
      where: { userId },
      select: { id: true, semesterId: true, academicTermId: true },
    });
    if (!student?.semesterId || !student.academicTermId)
      throw new Error("Student academic context is incomplete");

    const round = await db.feedbackRound.findUnique({
      where: { id: input.feedbackRoundId },
      include: { questionSet: { include: { questions: true } } },
    });
    if (
      !round ||
      !round.isEnabled ||
      new Date() < round.startsAt ||
      new Date() > round.endsAt
    ) {
      throw new Error("Feedback round is not active");
    }

    let ownership: {
      courseAssignmentId: string | null;
      electiveBatchFacultyId: string | null;
      courseId: string;
      facultyId: string;
      sectionId: string;
      batchId: string | null;
    };

    if (input.electiveBatchFacultyId) {
      const electiveAssignment = await db.electiveBatchFaculty.findFirst({
        where: {
          id: input.electiveBatchFacultyId,
          electiveBatch: {
            studentAssignments: { some: { studentId: student.id } },
          },
          course: {
            allowFeedback: true,
            approvalStatus: FACULTY_COURSE_STATUS,
            semesterId: student.semesterId,
          },
        },
        select: {
          id: true,
          facultyId: true,
          courseId: true,
          electiveBatch: { select: { id: true } },
        },
      });
      if (!electiveAssignment)
        throw new Error("You are not eligible for this course assignment");
      ownership = {
        courseAssignmentId: null,
        electiveBatchFacultyId: electiveAssignment.id,
        courseId: electiveAssignment.courseId,
        facultyId: electiveAssignment.facultyId,
        sectionId: electiveAssignment.electiveBatch.id,
        batchId: null,
      };
    } else {
      const assignment = await db.courseAssignment.findFirst({
        where: {
          id: input.courseAssignmentId,
          section: {
            semesterId: student.semesterId,
            studentSections: { some: { studentId: student.id } },
          },
          course: {
            allowFeedback: true,
            registrations: {
              some: {
                studentId: student.id,
                semesterId: student.semesterId,
                academicTermId: student.academicTermId,
                status: "ACTIVE",
                registrationType: { in: ["REGULAR", "RE_REGISTRATION"] },
              },
            },
          },
        },
        select: {
          id: true,
          courseId: true,
          facultyId: true,
          sectionId: true,
          batchId: true,
        },
      });
      if (!assignment)
        throw new Error("You are not eligible for this course assignment");
      ownership = {
        courseAssignmentId: assignment.id,
        electiveBatchFacultyId: null,
        courseId: assignment.courseId,
        facultyId: assignment.facultyId,
        sectionId: assignment.sectionId,
        batchId: assignment.batchId,
      };
    }

    const questionIds = new Set(
      round.questionSet.questions.map((question) => question.id)
    );
    if (
      input.answers.length !== 10 ||
      new Set(input.answers.map((answer) => answer.questionId)).size !== 10 ||
      input.answers.some((answer) => !questionIds.has(answer.questionId))
    ) {
      throw new Error("Exactly one valid answer is required for each question");
    }

    return db.feedbackResponse.create({
      data: {
        feedbackRoundId: round.id,
        studentId: student.id,
        courseAssignmentId: ownership.courseAssignmentId,
        electiveBatchFacultyId: ownership.electiveBatchFacultyId,
        courseId: ownership.courseId,
        facultyId: ownership.facultyId,
        sectionId: ownership.sectionId,
        batchId: ownership.batchId,
        answers: { create: input.answers },
      },
    });
  }

  static async getTermConfiguration(
    academicTermId: string,
    semesterId: string
  ) {
    return db.feedbackQuestionSet.findFirst({
      where: { academicTermId, semesterId },
      include: {
        preset: true,
        questions: { orderBy: { questionNumber: "asc" } },
        rounds: { orderBy: { roundNumber: "asc" } },
      },
    });
  }

  static async listPresets(academicTermId?: string) {
    return db.feedbackQuestionPreset.findMany({
      where: academicTermId
        ? { OR: [{ academicTermId }, { academicTermId: null }] }
        : undefined,
      include: { questions: { orderBy: { questionNumber: "asc" } } },
      orderBy: { name: "asc" },
    });
  }

  static async createPreset(userId: string, input: FeedbackPresetInput) {
    return db.feedbackQuestionPreset.create({
      data: {
        name: input.name,
        description: input.description,
        academicTermId: input.academicTermId,
        createdById: userId,
        questions: { create: input.questions },
      },
      include: { questions: true },
    });
  }

  static async configureTerm(
    userId: string,
    input: FeedbackTermConfigurationInput
  ) {
    const term = await db.academicTerm.findUnique({
      where: { id: input.academicTermId },
      select: { id: true },
    });
    if (!term) throw new Error("Academic term not found");
    const semester = await db.semester.findFirst({
      where: { id: input.semesterId, academicTermId: input.academicTermId },
      select: { id: true },
    });
    if (!semester)
      throw new Error("Semester does not belong to the selected academic term");
    const preset = await db.feedbackQuestionPreset.findUnique({
      where: { id: input.presetId },
      include: { questions: { orderBy: { questionNumber: "asc" } } },
    });
    if (!preset || preset.questions.length !== 10)
      throw new Error("Preset must contain exactly ten questions");
    const existing = await db.feedbackQuestionSet.findFirst({
      where: {
        academicTermId: input.academicTermId,
        semesterId: input.semesterId,
      },
    });
    if (
      existing &&
      (existing.isLocked ||
        (await db.feedbackRound.count({
          where: { questionSetId: existing.id },
        })) > 0)
    )
      throw new Error(
        "Term feedback questions are locked after round configuration begins"
      );
    return db.$transaction(async (tx) => {
      if (existing) {
        return tx.feedbackQuestionSet.update({
          where: { id: existing.id },
          data: {
            presetId: preset.id,
            questions: {
              deleteMany: {},
              create: preset.questions.map((question) => ({
                questionNumber: question.questionNumber,
                questionText: question.questionText,
              })),
            },
          },
          include: { questions: true },
        });
      }
      return tx.feedbackQuestionSet.create({
        data: {
          academicTermId: input.academicTermId,
          semesterId: input.semesterId,
          presetId: preset.id,
          createdById: userId,
          questions: {
            create: preset.questions.map((question) => ({
              questionNumber: question.questionNumber,
              questionText: question.questionText,
            })),
          },
        },
        include: { questions: true },
      });
    });
  }

  static async getFilterOptions(
    scope: FeedbackScope,
    filters?: {
      academicTermId?: string;
      semesterId?: string;
      courseId?: string;
    }
  ) {
    const assignments = await db.courseAssignment.findMany({
      where: {
        ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
        ...(scope.facultyId ? { facultyId: scope.facultyId } : {}),
        ...(filters?.courseId ? { courseId: filters.courseId } : {}),
        course: { allowFeedback: true },
        section: {
          ...(filters?.semesterId ? { semesterId: filters.semesterId } : {}),
          ...(filters?.academicTermId
            ? { semester: { academicTermId: filters.academicTermId } }
            : {}),
        },
      },
      select: {
        faculty: {
          select: {
            id: true,
            shortName: true,
            user: { select: { name: true } },
          },
        },
        course: { select: { id: true, code: true, name: true } },
        section: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      distinct: ["facultyId", "courseId", "sectionId", "batchId"],
    });

    const electiveAssignments = await db.electiveBatchFaculty.findMany({
      where: {
        ...(scope.facultyId ? { facultyId: scope.facultyId } : {}),
        course: {
          ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
          ...(filters?.courseId ? { id: filters.courseId } : {}),
          allowFeedback: true,
          ...(filters?.semesterId ? { semesterId: filters.semesterId } : {}),
          ...(filters?.academicTermId
            ? { semester: { academicTermId: filters.academicTermId } }
            : {}),
        },
      },
      select: {
        faculty: {
          select: {
            id: true,
            shortName: true,
            user: { select: { name: true } },
          },
        },
        course: { select: { id: true, code: true, name: true } },
        electiveBatch: { select: { id: true, name: true } },
      },
      distinct: ["facultyId", "courseId", "electiveBatchId"],
    });

    const rounds = await db.feedbackRound.findMany({
      where: {
        ...(filters?.semesterId ? { semesterId: filters.semesterId } : {}),
        ...(filters?.academicTermId
          ? { academicTermId: filters.academicTermId }
          : {}),
      },
      select: {
        id: true,
        roundNumber: true,
        name: true,
      },
      orderBy: { roundNumber: "asc" },
    });

    const facultyMap = new Map(
      assignments.map((item) => [item.faculty.id, item.faculty])
    );
    for (const item of electiveAssignments) {
      if (!facultyMap.has(item.faculty.id))
        facultyMap.set(item.faculty.id, item.faculty);
    }

    const courseMap = new Map(
      assignments.map((item) => [item.course.id, item.course])
    );
    for (const item of electiveAssignments) {
      if (!courseMap.has(item.course.id))
        courseMap.set(item.course.id, item.course);
    }

    const sectionMap = new Map<
      string,
      { id: string; name: string; isElectiveBatch?: boolean }
    >();
    for (const item of assignments) {
      if (!sectionMap.has(item.section.id)) {
        sectionMap.set(item.section.id, {
          id: item.section.id,
          name: item.section.name,
          isElectiveBatch: false,
        });
      }
    }
    for (const item of electiveAssignments) {
      if (!sectionMap.has(item.electiveBatch.id)) {
        sectionMap.set(item.electiveBatch.id, {
          id: item.electiveBatch.id,
          name: item.electiveBatch.name,
          isElectiveBatch: true,
        });
      }
    }

    return {
      faculty: [...facultyMap.values()],
      courses: [...courseMap.values()],
      sections: [...sectionMap.values()],
      batches: assignments
        .flatMap((item) => (item.batch ? [item.batch] : []))
        .filter(
          (item, index, all) =>
            all.findIndex((candidate) => candidate.id === item.id) === index
        ),
      departments: [
        ...new Map(
          assignments.map((item) => [item.department.id, item.department])
        ).values(),
      ],
      rounds,
    };
  }

  static async createRound(adminUserId: string, input: FeedbackRoundInput) {
    const questionSet = await db.feedbackQuestionSet.findFirst({
      where: {
        academicTermId: input.academicTermId,
        semesterId: input.semesterId,
      },
    });
    if (!questionSet) throw new Error("Configure feedback questions first");
    const roundKey = {
      academicTermId: input.academicTermId,
      semesterId: input.semesterId,
      roundNumber: input.roundNumber,
    };
    if (input.roundNumber > 1) {
      const previous = await db.feedbackRound.findFirst({
        where: {
          academicTermId: input.academicTermId,
          semesterId: input.semesterId,
          roundNumber: { lt: input.roundNumber },
        },
      });
      if (!previous)
        throw new Error(
          `Configure feedback round ${input.roundNumber - 1} first`
        );
    }
    const existing = await db.feedbackRound.findUnique({
      where: { academicTermId_semesterId_roundNumber: roundKey },
    });
    if (existing)
      throw new Error(`Feedback round ${input.roundNumber} already exists`);
    return db.feedbackRound.create({
      data: {
        ...input,
        name: input.name || `Round ${input.roundNumber}`,
        questionSetId: questionSet.id,
        createdById: adminUserId,
      },
    });
  }

  static async updateRound(id: string, input: FeedbackRoundUpdateInput) {
    return db.feedbackRound.update({ where: { id }, data: input });
  }

  static async setRoundEnabled(id: string, isEnabled: boolean) {
    return db.feedbackRound.update({ where: { id }, data: { isEnabled } });
  }

  static async deleteRound(id: string) {
    const existing = await db.feedbackRound.findUnique({ where: { id } });
    if (!existing) throw new Error("Feedback round not found");
    return db.feedbackRound.delete({ where: { id } });
  }

  static async getReport(query: FeedbackReportQuery, scope: FeedbackScope) {
    const rounds = await db.feedbackRound.findMany({
      where: {
        ...(query.feedbackRoundId ? { id: query.feedbackRoundId } : {}),
        ...(query.academicTermId
          ? { academicTermId: query.academicTermId }
          : {}),
        ...(query.semesterId ? { semesterId: query.semesterId } : {}),
      },
      include: {
        questionSet: {
          include: { questions: { orderBy: { questionNumber: "asc" } } },
        },
      },
    });
    const visibleRounds =
      query.includeOpen && scope.role === "admin"
        ? rounds
        : rounds.filter(roundIsVisible);
    const responses = await db.feedbackResponse.findMany({
      where: {
        feedbackRoundId: { in: visibleRounds.map((round) => round.id) },
        ...(query.courseId ? { courseId: query.courseId } : {}),
        ...(query.facultyId ? { facultyId: query.facultyId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.batchId ? { batchId: query.batchId } : {}),
        ...(scope.facultyId
          ? {
              facultyId: scope.facultyId,
            }
          : {}),
        ...(scope.departmentId || query.assignmentType || query.departmentId
          ? {
              OR: [
                {
                  courseAssignment: {
                    ...(scope.departmentId
                      ? { departmentId: scope.departmentId }
                      : {}),
                    ...(query.departmentId
                      ? { departmentId: query.departmentId }
                      : {}),
                    ...(query.assignmentType
                      ? { assignmentType: query.assignmentType }
                      : {}),
                  },
                },
                {
                  ...(query.assignmentType === "LAB"
                    ? { id: "00000000-0000-0000-0000-000000000000" }
                    : {
                        electiveBatchFaculty: {
                          ...(scope.departmentId
                            ? { course: { departmentId: scope.departmentId } }
                            : {}),
                          ...(query.departmentId
                            ? { course: { departmentId: query.departmentId } }
                            : {}),
                        },
                      }),
                },
              ],
            }
          : {}),
      },
      include: {
        answers: {
          include: { question: { select: { questionNumber: true } } },
        },
        course: { select: { code: true, name: true } },
        faculty: {
          select: {
            id: true,
            shortName: true,
            user: { select: { name: true } },
          },
        },
        courseAssignment: {
          select: {
            assignmentType: true,
            section: { select: { name: true } },
            batch: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
        electiveBatchFaculty: {
          select: {
            course: { select: { department: { select: { name: true } } } },
            electiveBatch: { select: { name: true } },
          },
        },
        feedbackRound: { select: { id: true, roundNumber: true, name: true } },
      },
    });

    const grouped = new Map<
      string,
      {
        key: string;
        roundNumber: number;
        roundName: string;
        course: (typeof responses)[number]["course"];
        faculty: (typeof responses)[number]["faculty"];
        assignmentType: string;
        section: string;
        batch: string | null;
        departmentName: string;
        responseCount: number;
        questionTotals: number[];
      }
    >();
    for (const response of responses) {
      const key = `${response.feedbackRoundId}:${
        response.courseAssignmentId ?? response.electiveBatchFacultyId
      }`;
      const group = grouped.get(key) ?? {
        key,
        roundNumber: response.feedbackRound.roundNumber,
        roundName: response.feedbackRound.name,
        course: response.course,
        faculty: response.faculty,
        assignmentType: response.courseAssignment?.assignmentType ?? "THEORY",
        section:
          response.courseAssignment?.section.name ??
          response.electiveBatchFaculty?.electiveBatch.name ??
          "",
        batch: response.courseAssignment?.batch?.name ?? null,
        departmentName:
          response.courseAssignment?.department.name ??
          response.electiveBatchFaculty?.course.department.name ??
          "",
        responseCount: 0,
        questionTotals: Array(10).fill(0),
      };
      group.responseCount += 1;
      for (const answer of response.answers)
        group.questionTotals[answer.question.questionNumber - 1] +=
          answer.score;
      grouped.set(key, group);
    }

    return [...grouped.values()]
      .map((group) => {
        const questionAverages = group.questionTotals.map(
          (total) => total / group.responseCount
        );
        const average =
          questionAverages.reduce((sum, value) => sum + value, 0) / 10;
        return {
          ...group,
          roundName: group.roundName || `Round ${group.roundNumber}`,
          questionAverages,
          average,
          percentage: (average / 5) * 100,
          scoreOutOf5: average,
        };
      })
      .filter((group) =>
        query.maxPercentage != null
          ? group.percentage <= query.maxPercentage
          : true
      );
  }

  static async getDashboard() {
    const rounds = await db.feedbackRound.findMany({
      include: {
        academicTerm: { select: { type: true, year: true, isCurrent: true } },
        semester: { select: { programType: true, semesterNumber: true } },
        _count: { select: { responses: true } },
      },
      orderBy: [{ academicTerm: { year: "desc" } }, { roundNumber: "asc" }],
    });
    const now = new Date();
    return rounds.map((round) => ({
      id: round.id,
      roundNumber: round.roundNumber,
      name: round.name || `Round ${round.roundNumber}`,
      startsAt: round.startsAt,
      endsAt: round.endsAt,
      isEnabled: round.isEnabled,
      academicTerm: round.academicTerm,
      semester: round.semester,
      responseCount: round._count.responses,
      status: roundStatus(round, now),
    }));
  }

  static async getRoundFaculties(roundId: string, departmentId?: string) {
    const round = await db.feedbackRound.findUnique({
      where: { id: roundId },
      include: {
        academicTerm: { select: { type: true, year: true, isCurrent: true } },
        semester: { select: { programType: true, semesterNumber: true } },
      },
    });
    if (!round) throw new Error("Feedback round not found");
    const assignments = await db.courseAssignment.findMany({
      where: {
        section: { semesterId: round.semesterId },
        course: { allowFeedback: true },
        ...(departmentId ? { departmentId } : {}),
      },
      select: {
        faculty: {
          select: {
            id: true,
            shortName: true,
            user: { select: { name: true } },
          },
        },
      },
      distinct: ["facultyId"],
      orderBy: { faculty: { user: { name: "asc" } } },
    });
    const electiveAssignments = await db.electiveBatchFaculty.findMany({
      where: {
        course: {
          allowFeedback: true,
          approvalStatus: FACULTY_COURSE_STATUS,
          semesterId: round.semesterId,
          ...(departmentId ? { departmentId } : {}),
        },
      },
      select: {
        faculty: {
          select: {
            id: true,
            shortName: true,
            user: { select: { name: true } },
          },
        },
      },
      distinct: ["facultyId"],
      orderBy: { faculty: { user: { name: "asc" } } },
    });
    const facultyById = new Map<
      string,
      { id: string; shortName: string; name: string }
    >();
    for (const assignment of [...assignments, ...electiveAssignments]) {
      if (!facultyById.has(assignment.faculty.id)) {
        facultyById.set(assignment.faculty.id, {
          id: assignment.faculty.id,
          shortName: assignment.faculty.shortName,
          name: assignment.faculty.user.name,
        });
      }
    }
    return {
      round: {
        id: round.id,
        roundNumber: round.roundNumber,
        name: round.name || `Round ${round.roundNumber}`,
        startsAt: round.startsAt,
        endsAt: round.endsAt,
        isEnabled: round.isEnabled,
        academicTermId: round.academicTermId,
        semesterId: round.semesterId,
        academicTerm: round.academicTerm,
        semester: round.semester,
        formattedAcademicYear: round.academicTerm.year,
        formattedSemester: toRoman(round.semester.semesterNumber),
        formattedProgram:
          round.semester.programType === "UG"
            ? "B.E"
            : round.semester.programType === "PG"
              ? "M.Tech"
              : round.semester.programType,
      },
      faculties: [...facultyById.values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    };
  }

  static async getRoundFacultyCourses(roundId: string, facultyId: string) {
    const round = await db.feedbackRound.findUnique({
      where: { id: roundId },
      select: { id: true, semesterId: true },
    });
    if (!round) throw new Error("Feedback round not found");
    const assignments = await db.courseAssignment.findMany({
      where: {
        facultyId,
        section: { semesterId: round.semesterId },
        course: { allowFeedback: true },
      },
      select: {
        course: { select: { id: true, code: true, name: true } },
        department: { select: { name: true } },
      },
      distinct: ["courseId"],
      orderBy: { course: { code: "asc" } },
    });
    const electiveAssignments = await db.electiveBatchFaculty.findMany({
      where: {
        facultyId,
        course: {
          allowFeedback: true,
          approvalStatus: FACULTY_COURSE_STATUS,
          semesterId: round.semesterId,
        },
      },
      select: {
        course: {
          select: { id: true, code: true, name: true, departmentName: true },
        },
      },
      distinct: ["courseId"],
      orderBy: { course: { code: "asc" } },
    });
    const courseById = new Map<
      string,
      { id: string; code: string; name: string; departmentName: string }
    >();
    for (const assignment of assignments) {
      courseById.set(assignment.course.id, {
        ...assignment.course,
        departmentName: assignment.department.name,
      });
    }
    for (const assignment of electiveAssignments) {
      if (!courseById.has(assignment.course.id)) {
        courseById.set(assignment.course.id, {
          ...assignment.course,
          departmentName: assignment.course.departmentName ?? "",
        });
      }
    }
    const courses = [...courseById.values()].sort((a, b) =>
      a.code.localeCompare(b.code)
    );
    const sectionCounts = await db.courseAssignment.groupBy({
      by: ["courseId"],
      where: {
        facultyId,
        section: { semesterId: round.semesterId },
        course: { allowFeedback: true },
      },
      _count: { _all: true },
    });
    const electiveSectionCounts = await db.electiveBatchFaculty.groupBy({
      by: ["courseId"],
      where: {
        facultyId,
        course: {
          allowFeedback: true,
          approvalStatus: FACULTY_COURSE_STATUS,
          semesterId: round.semesterId,
        },
      },
      _count: { _all: true },
    });
    const countById = new Map(
      [...sectionCounts, ...electiveSectionCounts].map((entry) => [
        entry.courseId,
        entry._count._all,
      ])
    );
    return courses.map((course) => ({
      ...course,
      sectionCount: countById.get(course.id) ?? 0,
    }));
  }

  static async getCourseDistribution(
    roundId: string,
    query: CourseDistributionQuery
  ) {
    const round = await db.feedbackRound.findUnique({
      where: { id: roundId },
      include: {
        academicTerm: { select: { type: true, year: true, isCurrent: true } },
        semester: { select: { programType: true, semesterNumber: true } },
        questionSet: {
          include: { questions: { orderBy: { questionNumber: "asc" } } },
        },
      },
    });
    if (!round) throw new Error("Feedback round not found");

    const course = await db.course.findUnique({
      where: { id: query.courseId },
      select: { courseType: true },
    });
    if (!course) {
      throw new Error(
        "No course assignment found for the selected faculty and course"
      );
    }
    const isBatchManaged = isBatchManagedCourse(course.courseType);

    const assignmentWhere: NonNullable<
      Parameters<typeof db.courseAssignment.findMany>[0]
    >["where"] = {
      facultyId: query.facultyId,
      courseId: query.courseId,
      section: { semesterId: round.semesterId },
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    };
    const electiveWhere: NonNullable<
      Parameters<typeof db.electiveBatchFaculty.findMany>[0]
    >["where"] = {
      facultyId: query.facultyId,
      courseId: query.courseId,
      course: {
        approvalStatus: FACULTY_COURSE_STATUS,
        semesterId: round.semesterId,
      },
      ...(query.sectionId ? { electiveBatchId: query.sectionId } : {}),
    };

    if (!isBatchManaged) {
      const assignments = await db.courseAssignment.findMany({
        where: assignmentWhere,
        select: { id: true },
      });
      if (!assignments.length) {
        throw new Error(
          "No course assignment found for the selected faculty and course"
        );
      }
      const assignmentIds = assignments.map((a) => a.id);

      const sections = await db.courseAssignment.findMany({
        where: assignmentWhere,
        include: { section: { select: { name: true } } },
        orderBy: { section: { name: "asc" } },
      });
      const sectionNames = [...new Set(sections.map((s) => s.section.name))];

      const firstAssignment = await db.courseAssignment.findFirst({
        where: assignmentWhere,
        select: {
          course: { select: { id: true, code: true, name: true } },
          department: { select: { name: true } },
          faculty: {
            select: { shortName: true, user: { select: { name: true } } },
          },
        },
      });
      if (!firstAssignment) {
        throw new Error(
          "No course assignment found for the selected faculty and course"
        );
      }

      const responses = await db.feedbackResponse.findMany({
        where: {
          feedbackRoundId: round.id,
          courseAssignmentId: { in: assignmentIds },
        },
        include: {
          answers: {
            include: { question: { select: { questionNumber: true } } },
          },
        },
      });

      return {
        metadata: {
          academicYear: round.academicTerm.year,
          semester: toRoman(round.semester.semesterNumber),
          program:
            round.semester.programType === "UG"
              ? "B.E"
              : round.semester.programType === "PG"
                ? "M.Tech"
                : round.semester.programType,
          branch: firstAssignment.department.name,
          courseCode: firstAssignment.course.code,
          courseName: firstAssignment.course.name,
          section: query.sectionId ? sectionNames.join(", ") : "All",
          facultyName: firstAssignment.faculty.user.name,
          totalStudents: responses.length,
        },
        questions: this.buildDistributionQuestions(
          round.questionSet.questions,
          responses
        ),
        totals: this.buildDistributionTotals(
          round.questionSet.questions,
          responses
        ),
      };
    }

    const electiveAssignments = await db.electiveBatchFaculty.findMany({
      where: electiveWhere,
      select: { id: true },
    });
    if (!electiveAssignments.length) {
      throw new Error(
        "No course assignment found for the selected faculty and course"
      );
    }
    const electiveIds = electiveAssignments.map((a) => a.id);

    const sections = await db.electiveBatchFaculty.findMany({
      where: electiveWhere,
      include: { electiveBatch: { select: { name: true } } },
      orderBy: { electiveBatch: { name: "asc" } },
    });
    const sectionNames = [
      ...new Set(sections.map((s) => s.electiveBatch.name)),
    ];

    const firstAssignment = await db.electiveBatchFaculty.findFirst({
      where: electiveWhere,
      select: {
        course: {
          select: { id: true, code: true, name: true, departmentName: true },
        },
        faculty: {
          select: { shortName: true, user: { select: { name: true } } },
        },
      },
    });
    if (!firstAssignment) {
      throw new Error(
        "No course assignment found for the selected faculty and course"
      );
    }

    const responses = await db.feedbackResponse.findMany({
      where: {
        feedbackRoundId: round.id,
        electiveBatchFacultyId: { in: electiveIds },
      },
      include: {
        answers: {
          include: { question: { select: { questionNumber: true } } },
        },
      },
    });

    return {
      metadata: {
        academicYear: round.academicTerm.year,
        semester: toRoman(round.semester.semesterNumber),
        program:
          round.semester.programType === "UG"
            ? "B.E"
            : round.semester.programType === "PG"
              ? "M.Tech"
              : round.semester.programType,
        branch: firstAssignment.course.departmentName ?? "",
        courseCode: firstAssignment.course.code,
        courseName: firstAssignment.course.name,
        section: query.sectionId ? sectionNames.join(", ") : "All",
        facultyName: firstAssignment.faculty.user.name,
        totalStudents: responses.length,
      },
      questions: this.buildDistributionQuestions(
        round.questionSet.questions,
        responses
      ),
      totals: this.buildDistributionTotals(
        round.questionSet.questions,
        responses
      ),
    };
  }

  private static buildDistributionQuestions(
    questions: Array<{ questionNumber: number; questionText: string }>,
    responses: Array<{
      answers: Array<{ score: number; question: { questionNumber: number } }>;
    }>
  ) {
    const countByQuestion = new Map<
      number,
      { 1: number; 2: number; 3: number; 4: number; 5: number }
    >();
    for (const response of responses) {
      for (const answer of response.answers) {
        const qNo = answer.question.questionNumber;
        const bucket = countByQuestion.get(qNo) ?? {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        };
        const score = Math.min(5, Math.max(1, answer.score)) as
          | 1
          | 2
          | 3
          | 4
          | 5;
        bucket[score] += 1;
        countByQuestion.set(qNo, bucket);
      }
    }
    return questions.map((question) => {
      const bucket = countByQuestion.get(question.questionNumber) ?? {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };
      const rowTotal =
        bucket[1] + bucket[2] + bucket[3] + bucket[4] + bucket[5];
      return {
        questionNumber: question.questionNumber,
        questionText: question.questionText,
        excellent: bucket[5],
        veryGood: bucket[4],
        good: bucket[3],
        fair: bucket[2],
        poor: bucket[1],
        rowTotal: rowTotal,
      };
    });
  }

  private static buildDistributionTotals(
    questions: Array<{ questionNumber: number; questionText: string }>,
    responses: Array<{
      answers: Array<{ score: number; question: { questionNumber: number } }>;
    }>
  ) {
    const builtQuestions = this.buildDistributionQuestions(
      questions,
      responses
    );
    const totalScore = builtQuestions.reduce(
      (sum, q) =>
        sum +
        q.excellent * 5 +
        q.veryGood * 4 +
        q.good * 3 +
        q.fair * 2 +
        q.poor,
      0
    );
    const totalAnswers = builtQuestions.reduce((sum, q) => sum + q.rowTotal, 0);
    const overallAverage = totalAnswers > 0 ? totalScore / totalAnswers : 0;
    return {
      excellent: builtQuestions.reduce((sum, q) => sum + q.excellent, 0),
      veryGood: builtQuestions.reduce((sum, q) => sum + q.veryGood, 0),
      good: builtQuestions.reduce((sum, q) => sum + q.good, 0),
      fair: builtQuestions.reduce((sum, q) => sum + q.fair, 0),
      poor: builtQuestions.reduce((sum, q) => sum + q.poor, 0),
      overallAverage,
    };
  }

  static async getRoundCourseSections(
    roundId: string,
    facultyId: string,
    courseId: string
  ) {
    const round = await db.feedbackRound.findUnique({
      where: { id: roundId },
      select: { id: true, semesterId: true },
    });
    if (!round) throw new Error("Feedback round not found");
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { courseType: true },
    });
    if (!course) return [];
    const isBatchManaged = isBatchManagedCourse(course.courseType);

    if (isBatchManaged) {
      const electiveAssignments = await db.electiveBatchFaculty.findMany({
        where: {
          facultyId,
          courseId,
          course: {
            approvalStatus: FACULTY_COURSE_STATUS,
            semesterId: round.semesterId,
          },
        },
        include: { electiveBatch: { select: { id: true, name: true } } },
        orderBy: { electiveBatch: { name: "asc" } },
      });
      if (!electiveAssignments.length) return [];

      const responses = await db.feedbackResponse.findMany({
        where: {
          feedbackRoundId: round.id,
          electiveBatchFacultyId: { in: electiveAssignments.map((a) => a.id) },
        },
        select: { electiveBatchFacultyId: true, studentId: true },
      });
      const filledByAssignment = new Map<string, Set<string>>();
      for (const response of responses) {
        const set =
          filledByAssignment.get(response.electiveBatchFacultyId ?? "") ??
          new Set();
        set.add(response.studentId);
        filledByAssignment.set(response.electiveBatchFacultyId ?? "", set);
      }

      return Promise.all(
        electiveAssignments.map(async (assignment) => {
          const enrolled = await db.electiveStudentAssignment.findMany({
            where: { courseId, electiveBatchId: assignment.electiveBatch.id },
            select: { studentId: true },
          });
          const filled = filledByAssignment.get(assignment.id)?.size ?? 0;
          return {
            assignmentId: assignment.id,
            sectionId: assignment.electiveBatch.id,
            sectionName: assignment.electiveBatch.name,
            assignmentType: "THEORY",
            enrolledCount: enrolled.length,
            filledCount: filled,
            notFilledCount: Math.max(enrolled.length - filled, 0),
          };
        })
      );
    }

    const assignments = await db.courseAssignment.findMany({
      where: {
        facultyId,
        courseId,
        section: { semesterId: round.semesterId },
      },
      include: { section: { select: { id: true, name: true } } },
      orderBy: { section: { name: "asc" } },
    });
    if (!assignments.length) return [];

    const responses = await db.feedbackResponse.findMany({
      where: {
        feedbackRoundId: round.id,
        courseAssignmentId: { in: assignments.map((a) => a.id) },
      },
      select: { courseAssignmentId: true, studentId: true },
    });
    const filledByAssignment = new Map<string, Set<string>>();
    for (const response of responses) {
      const key = response.courseAssignmentId ?? "";
      const set = filledByAssignment.get(key) ?? new Set();
      set.add(response.studentId);
      filledByAssignment.set(key, set);
    }

    const registered = await db.courseRegistration.findMany({
      where: { courseId, semesterId: round.semesterId },
      select: { studentId: true },
    });
    const registeredIds = new Set(registered.map((entry) => entry.studentId));

    return Promise.all(
      assignments.map(async (assignment) => {
        const memberships = await db.studentSection.findMany({
          where: { sectionId: assignment.sectionId },
          select: { studentId: true },
        });
        const enrolledIds = memberships
          .map((membership) => membership.studentId)
          .filter((studentId) => registeredIds.has(studentId));
        const filled = filledByAssignment.get(assignment.id)?.size ?? 0;
        return {
          assignmentId: assignment.id,
          sectionId: assignment.sectionId,
          sectionName: assignment.section.name,
          assignmentType: assignment.assignmentType,
          enrolledCount: enrolledIds.length,
          filledCount: filled,
          notFilledCount: Math.max(enrolledIds.length - filled, 0),
        };
      })
    );
  }

  static async getRoundSectionStudents(
    roundId: string,
    facultyId: string,
    courseId: string,
    sectionId: string
  ) {
    const round = await db.feedbackRound.findUnique({
      where: { id: roundId },
      select: { id: true, semesterId: true },
    });
    if (!round) throw new Error("Feedback round not found");
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { courseType: true },
    });
    if (!course) return { filled: [], notFilled: [] };
    const isBatchManaged = isBatchManagedCourse(course.courseType);

    if (isBatchManaged) {
      const electiveAssignment = await db.electiveBatchFaculty.findFirst({
        where: {
          facultyId,
          courseId,
          electiveBatchId: sectionId,
          course: {
            approvalStatus: FACULTY_COURSE_STATUS,
            semesterId: round.semesterId,
          },
        },
        select: { id: true },
      });
      if (!electiveAssignment) return { filled: [], notFilled: [] };

      const responses = await db.feedbackResponse.findMany({
        where: {
          feedbackRoundId: round.id,
          electiveBatchFacultyId: electiveAssignment.id,
        },
        include: {
          student: { select: { usn: true, user: { select: { name: true } } } },
        },
        orderBy: { student: { user: { name: "asc" } } },
      });
      const filledIds = new Set(
        responses.map((response) => response.studentId)
      );
      const filled = responses.map((response) => ({
        name: response.student.user.name,
        usn: response.student.usn,
      }));

      const batchStudents = await db.electiveStudentAssignment.findMany({
        where: { courseId, electiveBatchId: sectionId },
        include: {
          student: { select: { usn: true, user: { select: { name: true } } } },
        },
      });
      const notFilled = batchStudents
        .filter((assignment) => !filledIds.has(assignment.studentId))
        .map((assignment) => ({
          name: assignment.student.user.name,
          usn: assignment.student.usn,
        }));

      return { filled, notFilled };
    }

    const assignments = await db.courseAssignment.findMany({
      where: {
        facultyId,
        courseId,
        sectionId,
        section: { semesterId: round.semesterId },
      },
      select: { id: true },
    });
    if (!assignments.length) return { filled: [], notFilled: [] };

    const responses = await db.feedbackResponse.findMany({
      where: {
        feedbackRoundId: round.id,
        courseAssignmentId: { in: assignments.map((a) => a.id) },
      },
      include: {
        student: { select: { usn: true, user: { select: { name: true } } } },
      },
      orderBy: { student: { user: { name: "asc" } } },
    });
    const filledIds = new Set(responses.map((response) => response.studentId));
    const filled = responses.map((response) => ({
      name: response.student.user.name,
      usn: response.student.usn,
    }));

    const registered = await db.courseRegistration.findMany({
      where: { courseId, semesterId: round.semesterId },
      select: { studentId: true },
    });
    const registeredIds = new Set(registered.map((entry) => entry.studentId));

    const memberships = await db.studentSection.findMany({
      where: { sectionId },
      include: {
        student: { select: { usn: true, user: { select: { name: true } } } },
      },
    });
    const notFilled = memberships
      .filter(
        (membership) =>
          registeredIds.has(membership.studentId) &&
          !filledIds.has(membership.studentId)
      )
      .map((membership) => ({
        name: membership.student.user.name,
        usn: membership.student.usn,
      }));

    return { filled, notFilled };
  }

  static scoreLabel(score: number) {
    return FEEDBACK_SCORE_LABELS[score as keyof typeof FEEDBACK_SCORE_LABELS];
  }
}
