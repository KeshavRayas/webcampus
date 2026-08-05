import { db } from "@webcampus/db";
import type {
  FeedbackPresetInput,
  FeedbackReportQuery,
  FeedbackRoundInput,
  FeedbackRoundUpdateInput,
  FeedbackSubmissionInput,
  FeedbackTermConfigurationInput,
} from "@webcampus/schemas/feedback";
import type { FeedbackScope } from "./feedback-scope.service";

const FEEDBACK_SCORE_LABELS = {
  5: "Excellent",
  4: "Very Good",
  3: "Good",
  2: "Fair",
  1: "Poor",
} as const;

const roundIsVisible = (round: { isEnabled: boolean; endsAt: Date }) =>
  !round.isEnabled || new Date() > round.endsAt;

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

    return {
      rounds: rounds.map((round) => ({
        id: round.id,
        roundNumber: round.roundNumber,
        startsAt: round.startsAt,
        endsAt: round.endsAt,
        isEnabled: round.isEnabled,
        isActive:
          round.isEnabled &&
          new Date() >= round.startsAt &&
          new Date() <= round.endsAt,
        questions: round.questionSet.questions,
      })),
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        assignmentType: assignment.assignmentType,
        course: assignment.course,
        faculty: assignment.faculty,
        section: assignment.section,
        batch: assignment.batch,
        submissions: assignment.feedbackResponses,
      })),
    };
  }

  static async submitStudentFeedback(
    userId: string,
    input: FeedbackSubmissionInput
  ) {
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
        courseAssignmentId: assignment.id,
        courseId: assignment.courseId,
        facultyId: assignment.facultyId,
        sectionId: assignment.sectionId,
        batchId: assignment.batchId,
        answers: { create: input.answers },
      },
    });
  }

  static async getTermConfiguration(academicTermId: string) {
    return db.feedbackQuestionSet.findFirst({
      where: { academicTermId },
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
    const preset = await db.feedbackQuestionPreset.findUnique({
      where: { id: input.presetId },
      include: { questions: { orderBy: { questionNumber: "asc" } } },
    });
    if (!preset || preset.questions.length !== 10)
      throw new Error("Preset must contain exactly ten questions");
    const existing = await db.feedbackQuestionSet.findFirst({
      where: { academicTermId: input.academicTermId },
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

  static async getFilterOptions(scope: FeedbackScope) {
    const assignments = await db.courseAssignment.findMany({
      where: {
        ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
        ...(scope.facultyId ? { facultyId: scope.facultyId } : {}),
        course: { allowFeedback: true },
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
      },
      distinct: ["facultyId", "courseId", "sectionId", "batchId"],
    });
    const rounds = await db.feedbackRound.findMany({
      select: { id: true, roundNumber: true },
      orderBy: { roundNumber: "asc" },
    });

    return {
      faculty: [
        ...new Map(
          assignments.map((item) => [item.faculty.id, item.faculty])
        ).values(),
      ],
      courses: [
        ...new Map(
          assignments.map((item) => [item.course.id, item.course])
        ).values(),
      ],
      sections: [
        ...new Map(
          assignments.map((item) => [item.section.id, item.section])
        ).values(),
      ],
      batches: assignments
        .flatMap((item) => (item.batch ? [item.batch] : []))
        .filter(
          (item, index, all) =>
            all.findIndex((candidate) => candidate.id === item.id) === index
        ),
      rounds,
    };
  }

  static async createRound(adminUserId: string, input: FeedbackRoundInput) {
    const questionSet = await db.feedbackQuestionSet.findFirst({
      where: { academicTermId: input.academicTermId },
    });
    if (!questionSet) throw new Error("Configure feedback questions first");
    if (input.roundNumber > 1) {
      const previous = await db.feedbackRound.findUnique({
        where: {
          academicTermId_roundNumber: {
            academicTermId: input.academicTermId,
            roundNumber: input.roundNumber - 1,
          },
        },
      });
      if (!previous)
        throw new Error(
          `Configure feedback round ${input.roundNumber - 1} first`
        );
    }
    const existing = await db.feedbackRound.findUnique({
      where: {
        academicTermId_roundNumber: {
          academicTermId: input.academicTermId,
          roundNumber: input.roundNumber,
        },
      },
    });
    if (existing)
      throw new Error(`Feedback round ${input.roundNumber} already exists`);
    return db.feedbackRound.create({
      data: {
        ...input,
        semesterId: null,
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
    const visibleRounds = rounds.filter(roundIsVisible);
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
        ...(scope.departmentId || query.assignmentType
          ? {
              courseAssignment: {
                ...(scope.departmentId
                  ? { departmentId: scope.departmentId }
                  : {}),
                ...(query.assignmentType
                  ? { assignmentType: query.assignmentType }
                  : {}),
              },
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
          },
        },
        feedbackRound: { select: { id: true, roundNumber: true } },
      },
    });

    const grouped = new Map<
      string,
      {
        key: string;
        roundNumber: number;
        course: (typeof responses)[number]["course"];
        faculty: (typeof responses)[number]["faculty"];
        assignmentType: string;
        section: string;
        batch: string | null;
        responseCount: number;
        questionTotals: number[];
      }
    >();
    for (const response of responses) {
      const key = `${response.feedbackRoundId}:${response.courseAssignmentId}`;
      const group = grouped.get(key) ?? {
        key,
        roundNumber: response.feedbackRound.roundNumber,
        course: response.course,
        faculty: response.faculty,
        assignmentType: response.courseAssignment.assignmentType,
        section: response.courseAssignment.section.name,
        batch: response.courseAssignment.batch?.name ?? null,
        responseCount: 0,
        questionTotals: Array(10).fill(0),
      };
      group.responseCount += 1;
      for (const answer of response.answers)
        group.questionTotals[answer.question.questionNumber - 1] +=
          answer.score;
      grouped.set(key, group);
    }

    return [...grouped.values()].map((group) => {
      const questionAverages = group.questionTotals.map(
        (total) => total / group.responseCount
      );
      const average =
        questionAverages.reduce((sum, value) => sum + value, 0) / 10;
      return {
        ...group,
        questionAverages,
        average,
        percentage: (average / 5) * 100,
        scoreOutOf5: average,
      };
    });
  }

  static scoreLabel(score: number) {
    return FEEDBACK_SCORE_LABELS[score as keyof typeof FEEDBACK_SCORE_LABELS];
  }
}
