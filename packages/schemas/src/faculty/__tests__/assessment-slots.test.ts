/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import {
  ASSESSMENT_SLOT_TITLES,
  buildAssessmentSlots,
  enrichAssessmentSlots,
  findAssessmentForSlot,
  formatTheoryExamTitle,
  getCopySourceAssessments,
  parseCanonicalAssessmentTitle,
  titleForAssessmentSlot,
} from "../assessment-slots";

describe("buildAssessmentSlots", () => {
  it("returns no slots for SEE-only configuration", () => {
    expect(
      buildAssessmentSlots({
        theoryMaxExams: 0,
        theoryExamMaxMarks: 0,
        labMaxMarks: 0,
        aatMaxMarks: 0,
      })
    ).toEqual([]);
  });

  it("returns Theory(3)+Lab+AAT slots with canonical titles", () => {
    const slots = buildAssessmentSlots({
      theoryMaxExams: 3,
      theoryExamMaxMarks: 20,
      labMaxMarks: 25,
      aatMaxMarks: 10,
    });

    expect(slots).toEqual([
      {
        componentType: "LAB",
        sequence: 1,
        title: "Lab",
        maxMarks: 25,
      },
      {
        componentType: "THEORY",
        sequence: 1,
        title: "Theory Exam 1",
        maxMarks: 20,
      },
      {
        componentType: "THEORY",
        sequence: 2,
        title: "Theory Exam 2",
        maxMarks: 20,
      },
      {
        componentType: "THEORY",
        sequence: 3,
        title: "Theory Exam 3",
        maxMarks: 20,
      },
      {
        componentType: "AAT",
        sequence: 1,
        title: "AAT",
        maxMarks: 10,
      },
    ]);
  });

  it("returns Theory(2)+AAT without lab", () => {
    const slots = buildAssessmentSlots({
      theoryMaxExams: 2,
      theoryExamMaxMarks: 20,
      labMaxMarks: 0,
      aatMaxMarks: 10,
    });

    expect(slots.map((s) => s.title)).toEqual([
      "Theory Exam 1",
      "Theory Exam 2",
      "AAT",
    ]);
  });
});

describe("titleForAssessmentSlot", () => {
  it("maps each component to one canonical title", () => {
    expect(titleForAssessmentSlot("THEORY", 2)).toBe("Theory Exam 2");
    expect(titleForAssessmentSlot("LAB", 1)).toBe(ASSESSMENT_SLOT_TITLES.LAB);
    expect(titleForAssessmentSlot("AAT", 1)).toBe(ASSESSMENT_SLOT_TITLES.AAT);
  });
});

describe("parseCanonicalAssessmentTitle", () => {
  it("accepts canonical dashboard titles", () => {
    expect(parseCanonicalAssessmentTitle("Theory Exam 1")).toEqual({
      componentType: "THEORY",
      sequence: 1,
    });
    expect(parseCanonicalAssessmentTitle("Lab")).toEqual({
      componentType: "LAB",
      sequence: 1,
    });
    expect(parseCanonicalAssessmentTitle("aat")).toEqual({
      componentType: "AAT",
      sequence: 1,
    });
  });

  it("rejects ambiguous legacy titles", () => {
    expect(parseCanonicalAssessmentTitle("Theory 1")).toBeNull();
    expect(parseCanonicalAssessmentTitle("CIE 1")).toBeNull();
    expect(parseCanonicalAssessmentTitle("Internal 1")).toBeNull();
    expect(parseCanonicalAssessmentTitle("Lab Exam")).toBeNull();
  });
});

describe("findAssessmentForSlot", () => {
  const assessments = [
    {
      id: "t1",
      title: "Theory Exam 1",
      componentType: "THEORY" as const,
      sequence: 1,
    },
    {
      id: "legacy-lab",
      title: "Lab",
      componentType: null,
      sequence: null,
    },
  ];

  it("prefers componentType and sequence", () => {
    expect(
      findAssessmentForSlot(assessments, {
        componentType: "THEORY",
        sequence: 1,
      })?.id
    ).toBe("t1");
  });

  it("falls back to canonical title for legacy rows", () => {
    expect(
      findAssessmentForSlot(assessments, {
        componentType: "LAB",
        sequence: 1,
      })?.id
    ).toBe("legacy-lab");
  });
});

describe("enrichAssessmentSlots", () => {
  it("attaches assessment and copy sources per slot", () => {
    const assessments = [
      {
        id: "t1",
        title: "Theory Exam 1",
        componentType: "THEORY" as const,
        sequence: 1,
      },
      {
        id: "t2",
        title: "Theory Exam 2",
        componentType: "THEORY" as const,
        sequence: 2,
      },
    ];

    const slots = enrichAssessmentSlots(
      {
        theoryMaxExams: 2,
        theoryExamMaxMarks: 20,
        labMaxMarks: 0,
        aatMaxMarks: 0,
      },
      assessments
    );

    expect(slots[0]!.assessment?.id).toBe("t1");
    expect(slots[0]!.copySources.map((s) => s.id)).toEqual(["t2"]);
    expect(slots[1]!.assessment?.id).toBe("t2");
    expect(slots[1]!.copySources.map((s) => s.id)).toEqual(["t1"]);
    expect(slots.every((slot) => slot.editable)).toBe(true);
  });
});

describe("getCopySourceAssessments", () => {
  it("returns same-component assessments excluding the current slot", () => {
    const assessments = [
      {
        id: "t1",
        title: "Theory Exam 1",
        componentType: "THEORY" as const,
        sequence: 1,
      },
      {
        id: "t2",
        title: "Theory Exam 2",
        componentType: "THEORY" as const,
        sequence: 2,
      },
      {
        id: "aat",
        title: "AAT",
        componentType: "AAT" as const,
        sequence: 1,
      },
    ];

    const slot = {
      componentType: "THEORY" as const,
      sequence: 2,
      title: formatTheoryExamTitle(2),
      maxMarks: 20,
    };

    const sources = getCopySourceAssessments(assessments, slot);
    expect(sources.map((s) => s.id)).toEqual(["t1"]);
  });
});
