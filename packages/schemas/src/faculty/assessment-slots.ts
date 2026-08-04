import type { AssessmentComponentType } from "./assessment.schema";

/** Canonical display titles — must stay aligned with backfill title parsing. */
export const ASSESSMENT_SLOT_TITLES = {
  LAB: "Lab",
  AAT: "AAT",
} as const;

export function formatTheoryExamTitle(sequence: number): string {
  return `Theory Exam ${sequence}`;
}

export function titleForAssessmentSlot(
  componentType: AssessmentComponentType,
  sequence: number
): string {
  if (componentType === "THEORY") {
    return formatTheoryExamTitle(sequence);
  }
  if (componentType === "LAB") {
    return ASSESSMENT_SLOT_TITLES.LAB;
  }
  return ASSESSMENT_SLOT_TITLES.AAT;
}

export type AssessmentSlotInput = {
  theoryMaxExams: number;
  theoryExamMaxMarks: number;
  labMaxMarks: number;
  aatMaxMarks: number;
};

export type AssessmentSlot = {
  componentType: AssessmentComponentType;
  sequence: number;
  title: string;
  maxMarks: number;
};

export type ExistingAssessmentRef = {
  id: string;
  title: string;
  totalMarks?: number;
  componentType?: AssessmentComponentType | null;
  sequence?: number | null;
};

export type AssessmentSlotView = AssessmentSlot & {
  editable: true;
  copySources: ExistingAssessmentRef[];
  assessment?: ExistingAssessmentRef;
};

/**
 * Single source of truth for QP dashboard slots derived from course config.
 * Order matches the current dashboard: Lab → Theory exams → AAT.
 */
export function buildAssessmentSlots(
  course: AssessmentSlotInput
): AssessmentSlot[] {
  const slots: AssessmentSlot[] = [];

  if (course.labMaxMarks > 0) {
    slots.push({
      componentType: "LAB",
      sequence: 1,
      title: ASSESSMENT_SLOT_TITLES.LAB,
      maxMarks: course.labMaxMarks,
    });
  }

  for (let sequence = 1; sequence <= course.theoryMaxExams; sequence++) {
    slots.push({
      componentType: "THEORY",
      sequence,
      title: formatTheoryExamTitle(sequence),
      maxMarks: course.theoryExamMaxMarks,
    });
  }

  if (course.aatMaxMarks > 0) {
    slots.push({
      componentType: "AAT",
      sequence: 1,
      title: ASSESSMENT_SLOT_TITLES.AAT,
      maxMarks: course.aatMaxMarks,
    });
  }

  return slots;
}

/**
 * Resolves an existing template for a slot. Prefers typed fields; falls back to
 * canonical title for legacy rows that still lack componentType/sequence.
 */
export function findAssessmentForSlot(
  assessments: ExistingAssessmentRef[] | undefined,
  slot: Pick<AssessmentSlot, "componentType" | "sequence">
): ExistingAssessmentRef | undefined {
  if (!assessments?.length) {
    return undefined;
  }

  const typedMatch = assessments.find(
    (assessment) =>
      assessment.componentType === slot.componentType &&
      assessment.sequence === slot.sequence
  );
  if (typedMatch) {
    return typedMatch;
  }

  const canonicalTitle = titleForAssessmentSlot(
    slot.componentType,
    slot.sequence
  );
  return assessments.find((assessment) => assessment.title === canonicalTitle);
}

function assessmentMatchesComponent(
  assessment: ExistingAssessmentRef,
  componentType: AssessmentComponentType
): boolean {
  if (assessment.componentType === componentType) {
    return true;
  }

  const parsed = parseCanonicalAssessmentTitle(assessment.title);
  return parsed?.componentType === componentType;
}

/** Assessments in the same component family suitable as a copy source. */
export function getCopySourceAssessments(
  assessments: ExistingAssessmentRef[] | undefined,
  slot: AssessmentSlot
): ExistingAssessmentRef[] {
  if (!assessments?.length) {
    return [];
  }

  const current = findAssessmentForSlot(assessments, slot);

  return assessments.filter(
    (assessment) =>
      assessment.id !== current?.id &&
      assessmentMatchesComponent(assessment, slot.componentType)
  );
}

/**
 * Builds slot definitions enriched with existing assessments and copy sources.
 */
export function enrichAssessmentSlots(
  course: AssessmentSlotInput,
  assessments?: ExistingAssessmentRef[]
): AssessmentSlotView[] {
  return buildAssessmentSlots(course).map((slot) => ({
    ...slot,
    editable: true,
    assessment: findAssessmentForSlot(assessments, slot),
    copySources: getCopySourceAssessments(assessments, slot),
  }));
}

/**
 * Parses canonical dashboard titles into component slots.
 * Returns null for non-canonical legacy titles (CIE 1, Internal 1, etc.).
 */
export function parseCanonicalAssessmentTitle(title: string): {
  componentType: AssessmentComponentType;
  sequence: number;
} | null {
  const trimmed = title.trim();
  const theoryMatch = trimmed.match(/^Theory Exam\s*(\d+)$/i);
  if (theoryMatch) {
    const sequence = Number.parseInt(theoryMatch[1]!, 10);
    if (sequence >= 1) {
      return { componentType: "THEORY", sequence };
    }
    return null;
  }
  if (trimmed.toLowerCase() === ASSESSMENT_SLOT_TITLES.LAB.toLowerCase()) {
    return { componentType: "LAB", sequence: 1 };
  }
  if (trimmed.toUpperCase() === ASSESSMENT_SLOT_TITLES.AAT) {
    return { componentType: "AAT", sequence: 1 };
  }
  return null;
}
