export type ComponentType = "THEORY" | "LAB" | "AAT";

export type AggregationRule =
  | "BEST_N"
  | "SUM"
  | "SINGLE"
  | "AVERAGE"
  | "WEIGHTED";

export type AssessmentStatus = "PRESENT" | "ABSENT" | "MP";

export type CieEligibilityPolicy = "OVERALL_ONLY" | "COMPONENT_AND_OVERALL";

export type EligibilityStatus = "ELIGIBLE" | "NOT_ELIGIBLE";

export type AssessmentScoreInput = {
  sequence: number;
  /** null = no StudentAssessment row (unconducted) */
  score: number | null;
  status: AssessmentStatus | null;
  templateMax: number;
};

export type ComponentRuleParams = {
  bestN?: number;
  cap?: number;
  weight?: number;
};

export type ComponentInput = {
  componentType: ComponentType;
  rule: AggregationRule;
  ruleParams: ComponentRuleParams;
  maxForEligibility: number;
  eligibilityPct: number;
  active: boolean;
  assessments: AssessmentScoreInput[];
};

export type CourseAggregationConfig = {
  courseId: string;
  cieMaxMarks: number;
  cieEligibility: number;
  cieEligibilityPolicy: CieEligibilityPolicy;
  theoryMaxExams: number;
  theoryMinExams: number;
  theoryCieContribution: number;
  theoryTemplateCount: number;
  labMaxMarks: number;
  aatMaxMarks: number;
};

export type ComponentResult = {
  active: boolean;
  obtained: number;
  maxForEligibility: number;
  pct: number | null;
  eligible: boolean;
};

export type AggregationWarningType =
  | "CIE_TOTAL_EXCEEDS_MAX"
  | "THEORY_MIN_EXCEEDS_TEMPLATES"
  | "SCORE_EXCEEDS_TEMPLATE_MAX"
  | "THEORY_SEQUENCE_GAP";

export type AggregationWarning = {
  type: AggregationWarningType;
  courseId: string;
  studentId?: string;
  rule?: AggregationRule;
  component?: ComponentType | "CIE";
  expectedMax?: number;
  actualTotal?: number;
  theoryAggregate?: number;
  labAggregate?: number;
  aatAggregate?: number;
  cieTotal?: number;
  cieMaxMarks?: number;
  theoryMinExams?: number;
  theoryTemplateCount?: number;
  missingSequences?: number[];
};

export type AggregationResult = {
  theoryAggregate: number;
  labAggregate: number;
  aatAggregate: number;
  cieTotal: number;
  components: {
    theory: ComponentResult;
    lab: ComponentResult;
    aat: ComponentResult;
  };
  cie: {
    obtained: number;
    max: number;
    pct: number | null;
    eligible: boolean;
  };
  status: EligibilityStatus;
  warnings: AggregationWarning[];
};
