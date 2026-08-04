/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import { DuplicateComponentSequenceError } from "../assessment-aggregation.errors";
import {
  buildComponentInputs,
  validateCourseTemplateLayout,
} from "../assessment-aggregation.mapper";
import {
  applyRule,
  computeAggregation,
  computeEligibility,
  normalizeScore,
} from "../assessment-aggregation.service";
import type {
  AssessmentScoreInput,
  ComponentInput,
  CourseAggregationConfig,
} from "../assessment-aggregation.types";

const baseCourseConfig = (
  overrides: Partial<CourseAggregationConfig> = {}
): CourseAggregationConfig => ({
  courseId: "course-1",
  cieMaxMarks: 50,
  cieEligibility: 40,
  cieEligibilityPolicy: "COMPONENT_AND_OVERALL",
  theoryMaxExams: 3,
  theoryMinExams: 2,
  theoryTemplateCount: 3,
  labMaxMarks: 0,
  aatMaxMarks: 10,
  ...overrides,
});

describe("normalizeScore", () => {
  it("caps present scores at template max", () => {
    expect(normalizeScore(25, 20, "PRESENT")).toBe(20);
  });

  it("returns 0 for absent", () => {
    expect(normalizeScore(15, 20, "ABSENT")).toBe(0);
  });

  it("returns null for unconducted", () => {
    expect(normalizeScore(null, 20, null)).toBeNull();
  });
});

describe("applyRule", () => {
  const conducted = (
    sequence: number,
    score: number,
    status: AssessmentScoreInput["status"] = "PRESENT"
  ): AssessmentScoreInput => ({
    sequence,
    score,
    status,
    templateMax: 20,
  });

  it("BEST_N picks top N conducted scores", () => {
    const assessments = [conducted(1, 20), conducted(2, 18), conducted(3, 17)];
    expect(applyRule("BEST_N", assessments, { bestN: 2 })).toBe(38);
  });

  it("BEST_N ignores unconducted exams", () => {
    const assessments = [
      conducted(1, 20),
      conducted(2, 18),
      { sequence: 3, score: null, status: null, templateMax: 20 },
    ];
    expect(applyRule("BEST_N", assessments, { bestN: 2 })).toBe(38);
  });

  it("BEST_N treats absent as 0 in pool", () => {
    const assessments = [
      conducted(1, 20),
      conducted(2, 18, "ABSENT"),
      conducted(3, 17),
    ];
    expect(applyRule("BEST_N", assessments, { bestN: 2 })).toBe(37);
  });

  it("SINGLE returns first conducted score capped", () => {
    const assessments = [conducted(1, 15)];
    expect(applyRule("SINGLE", assessments, { cap: 10 })).toBe(10);
  });

  it("SUM sums conducted scores with cap", () => {
    const assessments = [conducted(1, 8), conducted(2, 7)];
    expect(applyRule("SUM", assessments, { cap: 12 })).toBe(12);
  });

  it("BEST_N handles ties deterministically (lower sequence wins tie-break)", () => {
    const orderA = [conducted(1, 18), conducted(2, 18), conducted(3, 15)];
    const orderB = [conducted(3, 15), conducted(1, 18), conducted(2, 18)];
    const orderC = [conducted(2, 18), conducted(3, 15), conducted(1, 18)];

    expect(applyRule("BEST_N", orderA, { bestN: 2 })).toBe(36);
    expect(applyRule("BEST_N", orderB, { bestN: 2 })).toBe(36);
    expect(applyRule("BEST_N", orderC, { bestN: 2 })).toBe(36);
  });
});

describe("computeEligibility", () => {
  const activePass = {
    active: true,
    obtained: 38,
    maxForEligibility: 40,
    pct: 95,
    eligible: true,
  };
  const activeFail = {
    active: true,
    obtained: 3,
    maxForEligibility: 10,
    pct: 30,
    eligible: false,
  };

  it("COMPONENT_AND_OVERALL fails when a component fails", () => {
    const { status } = computeEligibility(
      { theory: activePass, lab: emptyInactive(), aat: activeFail },
      41,
      baseCourseConfig()
    );
    expect(status).toBe("NOT_ELIGIBLE");
  });

  it("OVERALL_ONLY passes when CIE threshold met", () => {
    const { status } = computeEligibility(
      { theory: activePass, lab: emptyInactive(), aat: activeFail },
      41,
      baseCourseConfig({ cieEligibilityPolicy: "OVERALL_ONLY" })
    );
    expect(status).toBe("ELIGIBLE");
  });
});

function emptyInactive() {
  return {
    active: false,
    obtained: 0,
    maxForEligibility: 0,
    pct: null,
    eligible: true,
  };
}

describe("computeAggregation", () => {
  it("computes example: Theory best 2 + AAT = 47", () => {
    const course = {
      id: "course-1",
      cieMaxMarks: 50,
      cieEligibility: 40,
      cieEligibilityPolicy: "COMPONENT_AND_OVERALL" as const,
      theoryMaxExams: 3,
      theoryMinExams: 2,
      theoryExamMaxMarks: 20,
      theoryEligibility: 40,
      labMaxMarks: 0,
      labEligibility: 40,
      aatMaxMarks: 10,
      aatEligibility: 40,
    };

    const templates = [
      {
        id: "t1",
        componentType: "THEORY" as const,
        sequence: 1,
        totalMarks: 20,
      },
      {
        id: "t2",
        componentType: "THEORY" as const,
        sequence: 2,
        totalMarks: 20,
      },
      {
        id: "t3",
        componentType: "THEORY" as const,
        sequence: 3,
        totalMarks: 20,
      },
      {
        id: "aat",
        componentType: "AAT" as const,
        sequence: 1,
        totalMarks: 10,
      },
    ];

    const studentAssessments = [
      { assessmentId: "t1", totalMarks: 20, status: "PRESENT" },
      { assessmentId: "t2", totalMarks: 18, status: "PRESENT" },
      { assessmentId: "t3", totalMarks: 17, status: "PRESENT" },
      { assessmentId: "aat", totalMarks: 9, status: "PRESENT" },
    ];

    const components = buildComponentInputs(
      course,
      templates,
      studentAssessments
    );
    const result = computeAggregation(
      components,
      baseCourseConfig({ theoryTemplateCount: 3 }),
      "student-1"
    );

    expect(result.theoryAggregate).toBe(38);
    expect(result.labAggregate).toBe(0);
    expect(result.aatAggregate).toBe(9);
    expect(result.cieTotal).toBe(47);
    expect(result.status).toBe("ELIGIBLE");
  });

  it("clamps theory contribution when exam max exceeds its CIE share", () => {
    const components: ComponentInput[] = [
      {
        componentType: "THEORY",
        rule: "SINGLE",
        ruleParams: {},
        maxForEligibility: 40,
        eligibilityPct: 40,
        active: true,
        assessments: [
          {
            sequence: 1,
            score: 45,
            status: "PRESENT",
            templateMax: 45,
          },
        ],
      },
      {
        componentType: "LAB",
        rule: "SINGLE",
        ruleParams: {},
        maxForEligibility: 0,
        eligibilityPct: 40,
        active: false,
        assessments: [],
      },
      {
        componentType: "AAT",
        rule: "SINGLE",
        ruleParams: { cap: 10 },
        maxForEligibility: 10,
        eligibilityPct: 40,
        active: true,
        assessments: [
          {
            sequence: 1,
            score: 10,
            status: "PRESENT",
            templateMax: 10,
          },
        ],
      },
    ];

    const result = computeAggregation(components, baseCourseConfig(), "s1");
    expect(result.cieTotal).toBe(50);
    expect(
      result.warnings.some((w) => w.type === "CIE_TOTAL_EXCEEDS_MAX")
    ).toBe(false);
  });

  it("scales theory to its CIE contribution (regression: best 2 of 3)", () => {
    const course = {
      id: "course-1",
      cieMaxMarks: 50,
      cieEligibility: 40,
      cieEligibilityPolicy: "COMPONENT_AND_OVERALL" as const,
      theoryMaxExams: 3,
      theoryMinExams: 2,
      theoryExamMaxMarks: 40,
      theoryEligibility: 40,
      labMaxMarks: 0,
      labEligibility: 40,
      aatMaxMarks: 10,
      aatEligibility: 40,
    };

    const templates = [
      {
        id: "t1",
        componentType: "THEORY" as const,
        sequence: 1,
        totalMarks: 40,
      },
      {
        id: "t2",
        componentType: "THEORY" as const,
        sequence: 2,
        totalMarks: 40,
      },
      {
        id: "t3",
        componentType: "THEORY" as const,
        sequence: 3,
        totalMarks: 40,
      },
      { id: "aat", componentType: "AAT" as const, sequence: 1, totalMarks: 10 },
    ];

    const studentAssessments = [
      { assessmentId: "t1", totalMarks: 40, status: "PRESENT" },
      { assessmentId: "t2", totalMarks: 38, status: "PRESENT" },
      { assessmentId: "t3", totalMarks: 39, status: "PRESENT" },
      { assessmentId: "aat", totalMarks: 9, status: "PRESENT" },
    ];

    const components = buildComponentInputs(
      course,
      templates,
      studentAssessments
    );
    const result = computeAggregation(
      components,
      baseCourseConfig({ theoryTemplateCount: 3 }),
      "student-1"
    );

    expect(result.theoryAggregate).toBe(79);
    expect(result.aatAggregate).toBe(9);
    expect(result.cieTotal).toBe(48.5);
    expect(result.status).toBe("ELIGIBLE");
  });

  it("all-perfect theory caps cieTotal exactly at max without float drift", () => {
    const course = {
      id: "course-1",
      cieMaxMarks: 50,
      cieEligibility: 40,
      cieEligibilityPolicy: "COMPONENT_AND_OVERALL" as const,
      theoryMaxExams: 3,
      theoryMinExams: 2,
      theoryExamMaxMarks: 40,
      theoryEligibility: 40,
      labMaxMarks: 0,
      labEligibility: 40,
      aatMaxMarks: 10,
      aatEligibility: 40,
    };

    const templates = [
      {
        id: "t1",
        componentType: "THEORY" as const,
        sequence: 1,
        totalMarks: 40,
      },
      {
        id: "t2",
        componentType: "THEORY" as const,
        sequence: 2,
        totalMarks: 40,
      },
      {
        id: "t3",
        componentType: "THEORY" as const,
        sequence: 3,
        totalMarks: 40,
      },
      { id: "aat", componentType: "AAT" as const, sequence: 1, totalMarks: 10 },
    ];

    const studentAssessments = [
      { assessmentId: "t1", totalMarks: 40, status: "PRESENT" },
      { assessmentId: "t2", totalMarks: 40, status: "PRESENT" },
      { assessmentId: "t3", totalMarks: 40, status: "PRESENT" },
      { assessmentId: "aat", totalMarks: 10, status: "PRESENT" },
    ];

    const components = buildComponentInputs(
      course,
      templates,
      studentAssessments
    );
    const result = computeAggregation(
      components,
      baseCourseConfig({ theoryTemplateCount: 3 }),
      "student-1"
    );

    expect(result.theoryAggregate).toBe(80);
    expect(result.cieTotal).toBe(50);
  });

  it("all-zero theory yields zero theory contribution (scaling not skipped)", () => {
    const course = {
      id: "course-1",
      cieMaxMarks: 50,
      cieEligibility: 40,
      cieEligibilityPolicy: "COMPONENT_AND_OVERALL" as const,
      theoryMaxExams: 3,
      theoryMinExams: 2,
      theoryExamMaxMarks: 40,
      theoryEligibility: 40,
      labMaxMarks: 0,
      labEligibility: 40,
      aatMaxMarks: 10,
      aatEligibility: 40,
    };

    const templates = [
      {
        id: "t1",
        componentType: "THEORY" as const,
        sequence: 1,
        totalMarks: 40,
      },
      {
        id: "t2",
        componentType: "THEORY" as const,
        sequence: 2,
        totalMarks: 40,
      },
      {
        id: "t3",
        componentType: "THEORY" as const,
        sequence: 3,
        totalMarks: 40,
      },
      { id: "aat", componentType: "AAT" as const, sequence: 1, totalMarks: 10 },
    ];

    const studentAssessments = [
      { assessmentId: "t1", totalMarks: 0, status: "PRESENT" },
      { assessmentId: "t2", totalMarks: 0, status: "PRESENT" },
      { assessmentId: "t3", totalMarks: 0, status: "PRESENT" },
      { assessmentId: "aat", totalMarks: 10, status: "PRESENT" },
    ];

    const components = buildComponentInputs(
      course,
      templates,
      studentAssessments
    );
    const result = computeAggregation(
      components,
      baseCourseConfig({ theoryTemplateCount: 3 }),
      "student-1"
    );

    expect(result.theoryAggregate).toBe(0);
    expect(result.cieTotal).toBe(10);
  });

  it("rounds scaled theory contribution to two decimals", () => {
    const course = {
      id: "course-1",
      cieMaxMarks: 50,
      cieEligibility: 40,
      cieEligibilityPolicy: "COMPONENT_AND_OVERALL" as const,
      theoryMaxExams: 2,
      theoryMinExams: 2,
      theoryExamMaxMarks: 30,
      theoryEligibility: 40,
      labMaxMarks: 0,
      labEligibility: 40,
      aatMaxMarks: 10,
      aatEligibility: 40,
    };

    const templates = [
      {
        id: "t1",
        componentType: "THEORY" as const,
        sequence: 1,
        totalMarks: 30,
      },
      {
        id: "t2",
        componentType: "THEORY" as const,
        sequence: 2,
        totalMarks: 30,
      },
      { id: "aat", componentType: "AAT" as const, sequence: 1, totalMarks: 10 },
    ];

    const studentAssessments = [
      { assessmentId: "t1", totalMarks: 20, status: "PRESENT" },
      { assessmentId: "t2", totalMarks: 20, status: "PRESENT" },
      { assessmentId: "aat", totalMarks: 9, status: "PRESENT" },
    ];

    const components = buildComponentInputs(
      course,
      templates,
      studentAssessments
    );
    const result = computeAggregation(
      components,
      baseCourseConfig({ theoryTemplateCount: 2 }),
      "student-1"
    );

    expect(result.theoryAggregate).toBe(40);
    expect(result.cieTotal).toBe(35.67);
  });
});

describe("validateCourseTemplateLayout", () => {
  it("throws DuplicateComponentSequenceError for duplicate THEORY sequence", () => {
    const templates = [
      {
        id: "t1",
        componentType: "THEORY" as const,
        sequence: 1,
        totalMarks: 20,
      },
      {
        id: "t2",
        componentType: "THEORY" as const,
        sequence: 2,
        totalMarks: 20,
      },
      {
        id: "t3",
        componentType: "THEORY" as const,
        sequence: 2,
        totalMarks: 20,
      },
    ];

    expect(() =>
      validateCourseTemplateLayout({ id: "course-1" }, templates)
    ).toThrow(DuplicateComponentSequenceError);

    try {
      validateCourseTemplateLayout({ id: "course-1" }, templates);
    } catch (error) {
      expect(error).toBeInstanceOf(DuplicateComponentSequenceError);
      const dup = error as DuplicateComponentSequenceError;
      expect(dup.code).toBe("DUPLICATE_COMPONENT_SEQUENCE");
      expect(dup.componentType).toBe("THEORY");
      expect(dup.sequence).toBe(2);
      expect(dup.templateIds).toEqual(["t2", "t3"]);
    }
  });

  it("returns THEORY_SEQUENCE_GAP warning but does not throw", () => {
    const warnings = validateCourseTemplateLayout({ id: "course-1" }, [
      {
        id: "t1",
        componentType: "THEORY",
        sequence: 1,
        totalMarks: 20,
      },
      {
        id: "t3",
        componentType: "THEORY",
        sequence: 3,
        totalMarks: 20,
      },
    ]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.type).toBe("THEORY_SEQUENCE_GAP");
    expect(warnings[0]?.missingSequences).toEqual([2]);
  });

  it("buildComponentInputs throws on duplicate sequence before aggregation", () => {
    const course = {
      id: "course-1",
      cieMaxMarks: 50,
      cieEligibility: 40,
      cieEligibilityPolicy: "COMPONENT_AND_OVERALL" as const,
      theoryMaxExams: 3,
      theoryMinExams: 2,
      theoryExamMaxMarks: 20,
      theoryEligibility: 40,
      labMaxMarks: 0,
      labEligibility: 40,
      aatMaxMarks: 0,
      aatEligibility: 40,
    };

    const templates = [
      {
        id: "a",
        componentType: "THEORY" as const,
        sequence: 1,
        totalMarks: 20,
      },
      {
        id: "b",
        componentType: "THEORY" as const,
        sequence: 2,
        totalMarks: 20,
      },
      {
        id: "c",
        componentType: "THEORY" as const,
        sequence: 2,
        totalMarks: 20,
      },
    ];

    expect(() => buildComponentInputs(course, templates, [])).toThrow(
      DuplicateComponentSequenceError
    );
  });
});
