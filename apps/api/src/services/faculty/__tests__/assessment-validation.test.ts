/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import { DuplicateComponentSequenceError } from "../../shared/assessment-aggregation.errors";
import {
  assertNoDuplicateComponentSlot,
  assertSingletonComponentAvailable,
  assertTemplateLayoutForCreate,
  validateAssessmentComponentFields,
} from "../assessment-validation";

const course = {
  id: "course-1",
  theoryMaxExams: 3,
  theoryMinExams: 2,
  labMaxMarks: 25,
  aatMaxMarks: 10,
};

describe("validateAssessmentComponentFields", () => {
  it("rejects theory sequence above theoryMaxExams", () => {
    expect(() =>
      validateAssessmentComponentFields(
        { componentType: "THEORY", sequence: 4 },
        course
      )
    ).toThrow("exceeds configured theoryMaxExams");
  });

  it("rejects lab assessment when course has no lab marks configured", () => {
    expect(() =>
      validateAssessmentComponentFields(
        { componentType: "LAB", sequence: 1 },
        { ...course, labMaxMarks: 0 }
      )
    ).toThrow("no configured lab assessment");
  });
});

describe("assertTemplateLayoutForCreate", () => {
  it("throws DuplicateComponentSequenceError for duplicate slots in layout", () => {
    expect(() =>
      assertTemplateLayoutForCreate(
        course,
        [
          {
            id: "template-1",
            componentType: "THEORY",
            sequence: 1,
            totalMarks: 20,
          },
        ],
        { componentType: "THEORY", sequence: 1, totalMarks: 20 }
      )
    ).toThrow(DuplicateComponentSequenceError);
  });
});

describe("assertNoDuplicateComponentSlot", () => {
  it("throws when another template occupies the slot", () => {
    expect(() =>
      assertNoDuplicateComponentSlot(
        "course-1",
        "THEORY",
        2,
        undefined,
        "template-2"
      )
    ).toThrow(DuplicateComponentSequenceError);
  });
});

describe("assertSingletonComponentAvailable", () => {
  it("throws when LAB already exists", () => {
    expect(() =>
      assertSingletonComponentAvailable(
        "course-1",
        "LAB",
        undefined,
        "lab-template"
      )
    ).toThrow(DuplicateComponentSequenceError);
  });
});
