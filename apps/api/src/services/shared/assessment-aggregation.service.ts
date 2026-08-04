import type {
  AggregationResult,
  AggregationRule,
  AggregationWarning,
  AssessmentScoreInput,
  AssessmentStatus,
  ComponentInput,
  ComponentResult,
  ComponentRuleParams,
  ComponentType,
  CourseAggregationConfig,
  EligibilityStatus,
} from "./assessment-aggregation.types";

/**
 * Pure marks aggregation — no Prisma, Express, or DB dependencies.
 */
export function normalizeScore(
  rawScore: number | null,
  templateMax: number,
  status: AssessmentStatus | null
): number | null {
  if (status === "ABSENT") {
    return 0;
  }
  if (rawScore === null || status === null) {
    return null;
  }
  return Math.min(rawScore, templateMax);
}

export function applyRule(
  rule: AggregationRule,
  assessments: AssessmentScoreInput[],
  params: ComponentRuleParams
): number {
  const pool = assessments
    .map((a) => ({
      sequence: a.sequence,
      effective: normalizeScore(a.score, a.templateMax, a.status),
    }))
    .filter((a) => a.effective !== null) as Array<{
    sequence: number;
    effective: number;
  }>;

  switch (rule) {
    case "SINGLE": {
      if (pool.length === 0) {
        return 0;
      }
      const score = pool[0]!.effective;
      if (params.cap !== undefined) {
        return Math.min(score, params.cap);
      }
      return score;
    }
    case "SUM": {
      const sum = pool.reduce((acc, row) => acc + row.effective, 0);
      if (params.cap !== undefined) {
        return Math.min(sum, params.cap);
      }
      return sum;
    }
    case "BEST_N": {
      const n = params.bestN ?? 0;
      if (n <= 0 || pool.length === 0) {
        return 0;
      }
      // Sort by score descending; ties broken by lower sequence first (deterministic).
      const sorted = [...pool].sort((a, b) => {
        if (b.effective !== a.effective) {
          return b.effective - a.effective;
        }
        return a.sequence - b.sequence;
      });
      const take = Math.min(n, sorted.length);
      return sorted.slice(0, take).reduce((acc, row) => acc + row.effective, 0);
    }
    case "AVERAGE":
    case "WEIGHTED":
      return 0;
    default:
      return 0;
  }
}

function emptyComponentResult(): ComponentResult {
  return {
    active: false,
    obtained: 0,
    maxForEligibility: 0,
    pct: null,
    eligible: true,
  };
}

function evaluateComponentEligibility(
  obtained: number,
  maxForEligibility: number,
  eligibilityPct: number,
  active: boolean
): ComponentResult {
  if (!active || maxForEligibility <= 0) {
    return {
      active: false,
      obtained: 0,
      maxForEligibility: 0,
      pct: null,
      eligible: true,
    };
  }
  const pct = (obtained / maxForEligibility) * 100;
  return {
    active: true,
    obtained,
    maxForEligibility,
    pct,
    eligible: pct >= eligibilityPct,
  };
}

export function computeComponent(
  input: ComponentInput,
  courseConfig: CourseAggregationConfig,
  studentId?: string
): { result: ComponentResult; warnings: AggregationWarning[] } {
  const warnings: AggregationWarning[] = [];

  if (!input.active) {
    return { result: emptyComponentResult(), warnings };
  }

  if (
    input.componentType === "THEORY" &&
    input.rule === "BEST_N" &&
    input.ruleParams.bestN !== undefined &&
    input.ruleParams.bestN > courseConfig.theoryTemplateCount
  ) {
    warnings.push({
      type: "THEORY_MIN_EXCEEDS_TEMPLATES",
      courseId: courseConfig.courseId,
      studentId,
      rule: "BEST_N",
      component: "THEORY",
      theoryMinExams: input.ruleParams.bestN,
      theoryTemplateCount: courseConfig.theoryTemplateCount,
    });
  }

  for (const assessment of input.assessments) {
    if (
      assessment.score !== null &&
      assessment.status !== "ABSENT" &&
      assessment.score > assessment.templateMax
    ) {
      warnings.push({
        type: "SCORE_EXCEEDS_TEMPLATE_MAX",
        courseId: courseConfig.courseId,
        studentId,
        component: input.componentType,
        expectedMax: assessment.templateMax,
        actualTotal: assessment.score,
      });
    }
  }

  const obtained = applyRule(input.rule, input.assessments, input.ruleParams);
  const result = evaluateComponentEligibility(
    obtained,
    input.maxForEligibility,
    input.eligibilityPct,
    input.active
  );

  return { result, warnings };
}

export function computeEligibility(
  components: {
    theory: ComponentResult;
    lab: ComponentResult;
    aat: ComponentResult;
  },
  cieTotal: number,
  courseConfig: CourseAggregationConfig
): {
  cie: AggregationResult["cie"];
  status: EligibilityStatus;
} {
  const cieMax = courseConfig.cieMaxMarks;
  const cieEligible =
    cieMax <= 0
      ? true
      : (cieTotal / cieMax) * 100 >= courseConfig.cieEligibility;

  const ciePct = cieMax > 0 ? (cieTotal / cieMax) * 100 : null;

  const activeComponents = [
    components.theory,
    components.lab,
    components.aat,
  ].filter((c) => c.active);
  const allComponentsEligible = activeComponents.every((c) => c.eligible);

  let status: EligibilityStatus;
  if (courseConfig.cieEligibilityPolicy === "OVERALL_ONLY") {
    status = cieEligible ? "ELIGIBLE" : "NOT_ELIGIBLE";
  } else {
    status = cieEligible && allComponentsEligible ? "ELIGIBLE" : "NOT_ELIGIBLE";
  }

  return {
    cie: {
      obtained: cieTotal,
      max: cieMax,
      pct: ciePct,
      eligible: cieEligible,
    },
    status,
  };
}

export function computeAggregation(
  components: ComponentInput[],
  courseConfig: CourseAggregationConfig,
  studentId?: string
): AggregationResult {
  const warnings: AggregationWarning[] = [];

  const byType = new Map<ComponentType, ComponentInput>();
  for (const component of components) {
    byType.set(component.componentType, component);
  }

  const theoryInput = byType.get("THEORY");
  const labInput = byType.get("LAB");
  const aatInput = byType.get("AAT");

  const theoryComputed = theoryInput
    ? computeComponent(theoryInput, courseConfig, studentId)
    : { result: emptyComponentResult(), warnings: [] };
  const labComputed = labInput
    ? computeComponent(labInput, courseConfig, studentId)
    : { result: emptyComponentResult(), warnings: [] };
  const aatComputed = aatInput
    ? computeComponent(aatInput, courseConfig, studentId)
    : { result: emptyComponentResult(), warnings: [] };

  warnings.push(
    ...theoryComputed.warnings,
    ...labComputed.warnings,
    ...aatComputed.warnings
  );

  const theoryAggregate = theoryComputed.result.obtained;
  const labAggregate = labComputed.result.obtained;
  const aatAggregate = aatComputed.result.obtained;

  const theoryMax = theoryInput?.maxForEligibility ?? 0;
  const theoryContributionMax = Math.max(
    0,
    courseConfig.cieMaxMarks -
      (courseConfig.labMaxMarks ?? 0) -
      (courseConfig.aatMaxMarks ?? 0)
  );
  const theoryContribution =
    theoryMax > 0
      ? Math.min(
          theoryContributionMax,
          (theoryAggregate / theoryMax) * theoryContributionMax
        )
      : 0;
  const cieTotal = Number(
    (theoryContribution + labAggregate + aatAggregate).toFixed(2)
  );

  if (courseConfig.cieMaxMarks > 0 && cieTotal > courseConfig.cieMaxMarks) {
    warnings.push({
      type: "CIE_TOTAL_EXCEEDS_MAX",
      courseId: courseConfig.courseId,
      studentId,
      component: "CIE",
      cieMaxMarks: courseConfig.cieMaxMarks,
      cieTotal,
      theoryAggregate,
      labAggregate,
      aatAggregate,
    });
  }

  const componentResults = {
    theory: theoryComputed.result,
    lab: labComputed.result,
    aat: aatComputed.result,
  };

  const { cie, status } = computeEligibility(
    componentResults,
    cieTotal,
    courseConfig
  );

  return {
    theoryAggregate,
    labAggregate,
    aatAggregate,
    cieTotal,
    components: componentResults,
    cie,
    status,
    warnings,
  };
}
