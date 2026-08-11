import type {
  AssessmentComponentType,
  CieEligibilityPolicy,
} from "@webcampus/db";
import { DuplicateComponentSequenceError } from "./assessment-aggregation.errors";
import type {
  AggregationWarning,
  AssessmentScoreInput,
  AssessmentStatus,
  ComponentInput,
  ComponentType,
  CourseAggregationConfig,
} from "./assessment-aggregation.types";

export type CourseAggregationSource = {
  id: string;
  cieMaxMarks: number;
  cieEligibility: number;
  cieEligibilityPolicy: CieEligibilityPolicy;
  theoryMaxExams: number;
  theoryMinExams: number;
  theoryExamMaxMarks: number;
  theoryCieContribution: number;
  theoryEligibility: number;
  labMaxMarks: number;
  labEligibility: number;
  aatMaxMarks: number;
  aatEligibility: number;
};

export type TemplateAggregationSource = {
  id: string;
  componentType: AssessmentComponentType | null;
  sequence: number;
  totalMarks: number;
};

export type StudentAssessmentSource = {
  assessmentId: string;
  totalMarks: number;
  status: string;
};

export function toCourseAggregationConfig(
  course: CourseAggregationSource,
  theoryTemplateCount: number
): CourseAggregationConfig {
  return {
    courseId: course.id,
    cieMaxMarks: course.cieMaxMarks,
    cieEligibility: course.cieEligibility,
    cieEligibilityPolicy: course.cieEligibilityPolicy,
    theoryMaxExams: course.theoryMaxExams,
    theoryMinExams: course.theoryMinExams,
    theoryCieContribution: course.theoryCieContribution,
    theoryTemplateCount,
    labMaxMarks: course.labMaxMarks,
    aatMaxMarks: course.aatMaxMarks,
  };
}

function toAssessmentStatus(status: string): AssessmentStatus | null {
  if (status === "PRESENT" || status === "ABSENT" || status === "MP") {
    return status;
  }
  return null;
}

function buildAssessmentScores(
  templates: TemplateAggregationSource[],
  studentAssessmentsByTemplateId: Map<string, StudentAssessmentSource>
): AssessmentScoreInput[] {
  return templates
    .sort((a, b) => a.sequence - b.sequence)
    .map((template) => {
      const studentAssessment = studentAssessmentsByTemplateId.get(template.id);
      if (!studentAssessment) {
        return {
          sequence: template.sequence,
          score: null,
          status: null,
          templateMax: template.totalMarks,
        };
      }
      return {
        sequence: template.sequence,
        score: studentAssessment.totalMarks,
        status: toAssessmentStatus(studentAssessment.status),
        templateMax: template.totalMarks,
      };
    });
}

export function validateCourseTemplateLayout(
  course: { id: string },
  templates: TemplateAggregationSource[]
): AggregationWarning[] {
  const typedTemplates = templates.filter((t) => t.componentType !== null);
  const componentTypes: ComponentType[] = ["THEORY", "LAB", "AAT"];

  for (const componentType of componentTypes) {
    const ofType = typedTemplates.filter(
      (t) => t.componentType === componentType
    );
    const sequenceToTemplateIds = new Map<number, string[]>();

    for (const template of ofType) {
      const ids = sequenceToTemplateIds.get(template.sequence) ?? [];
      ids.push(template.id);
      sequenceToTemplateIds.set(template.sequence, ids);
    }

    for (const [sequence, templateIds] of sequenceToTemplateIds.entries()) {
      if (templateIds.length > 1) {
        throw new DuplicateComponentSequenceError(
          course.id,
          componentType,
          sequence,
          templateIds
        );
      }
    }
  }

  const warnings: AggregationWarning[] = [];
  const theorySequences = typedTemplates
    .filter((t) => t.componentType === "THEORY")
    .map((t) => t.sequence)
    .sort((a, b) => a - b);

  if (theorySequences.length > 1) {
    const min = theorySequences[0]!;
    const max = theorySequences[theorySequences.length - 1]!;
    const present = new Set(theorySequences);
    const missingSequences: number[] = [];

    for (let sequence = min; sequence <= max; sequence++) {
      if (!present.has(sequence)) {
        missingSequences.push(sequence);
      }
    }

    if (missingSequences.length > 0) {
      warnings.push({
        type: "THEORY_SEQUENCE_GAP",
        courseId: course.id,
        component: "THEORY",
        missingSequences,
      });
    }
  }

  return warnings;
}

export function buildComponentInputs(
  course: CourseAggregationSource,
  templates: TemplateAggregationSource[],
  studentAssessments: StudentAssessmentSource[]
): ComponentInput[] {
  validateCourseTemplateLayout(course, templates);

  const typedTemplates = templates.filter((t) => t.componentType !== null);

  const studentAssessmentsByTemplateId = new Map<
    string,
    StudentAssessmentSource
  >();
  for (const assessment of studentAssessments) {
    studentAssessmentsByTemplateId.set(assessment.assessmentId, assessment);
  }

  const theoryTemplates = typedTemplates.filter(
    (t) => t.componentType === "THEORY"
  );
  const labTemplates = typedTemplates.filter((t) => t.componentType === "LAB");
  const aatTemplates = typedTemplates.filter((t) => t.componentType === "AAT");

  const theoryActive = course.theoryMaxExams > 0;
  const labActive = course.labMaxMarks > 0;
  const aatActive = course.aatMaxMarks > 0;

  const components: ComponentInput[] = [];

  components.push({
    componentType: "THEORY",
    rule: "BEST_N",
    ruleParams: {
      bestN: course.theoryMinExams,
    },
    maxForEligibility: course.theoryExamMaxMarks * course.theoryMinExams,
    eligibilityPct: course.theoryEligibility,
    active: theoryActive,
    assessments: buildAssessmentScores(
      theoryTemplates,
      studentAssessmentsByTemplateId
    ),
  });

  components.push({
    componentType: "LAB",
    rule: "SINGLE",
    ruleParams: { cap: course.labMaxMarks },
    maxForEligibility: course.labMaxMarks,
    eligibilityPct: course.labEligibility,
    active: labActive,
    assessments: buildAssessmentScores(
      labTemplates,
      studentAssessmentsByTemplateId
    ),
  });

  components.push({
    componentType: "AAT",
    rule: "SINGLE",
    ruleParams: { cap: course.aatMaxMarks },
    maxForEligibility: course.aatMaxMarks,
    eligibilityPct: course.aatEligibility,
    active: aatActive,
    assessments: buildAssessmentScores(
      aatTemplates,
      studentAssessmentsByTemplateId
    ),
  });

  return components;
}
