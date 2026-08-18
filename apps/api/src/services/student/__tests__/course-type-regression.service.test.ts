/// <reference types="bun" />

import { COURSE_TYPES } from "@webcampus/schemas/constants";
import { describe, expect, it } from "bun:test";
import {
  coreRegistrationStrategy,
  oeRegistrationStrategy,
  peRegistrationStrategy,
  strategyFor,
} from "../registration-strategies";

const ALL_COURSE_TYPES = COURSE_TYPES;

describe("registration classification: every course type lands in exactly one bucket", () => {
  it("classifies PE as professional elective", () => {
    expect(strategyFor("PE")).toBe(peRegistrationStrategy);
  });

  it("classifies OE as open elective", () => {
    expect(strategyFor("OE")).toBe(oeRegistrationStrategy);
  });

  it("classifies every non-elective type (incl. PW and the 19 new types) as core", () => {
    const nonElectives = ALL_COURSE_TYPES.filter(
      (courseType) => courseType !== "PE" && courseType !== "OE"
    );
    for (const courseType of nonElectives) {
      expect(
        strategyFor(courseType),
        `${courseType} should map to core strategy`
      ).toBe(coreRegistrationStrategy);
    }
  });

  it("falls back to core for unknown types", () => {
    expect(strategyFor("UNKNOWN" as never)).toBe(coreRegistrationStrategy);
  });

  it("positive + negative: PW is core, PE is NOT core, OE is NOT core", () => {
    expect(coreRegistrationStrategy.matches("PW")).toBe(true);
    expect(coreRegistrationStrategy.matches("CC")).toBe(true);
    expect(coreRegistrationStrategy.matches("ETC")).toBe(true);
    expect(coreRegistrationStrategy.matches("PE")).toBe(false);
    expect(coreRegistrationStrategy.matches("OE")).toBe(false);
  });

  it("pe strategy matches only PE; oe strategy matches only OE", () => {
    for (const courseType of ALL_COURSE_TYPES) {
      expect(peRegistrationStrategy.matches(courseType)).toBe(
        courseType === "PE"
      );
      expect(oeRegistrationStrategy.matches(courseType)).toBe(
        courseType === "OE"
      );
    }
  });
});

describe("core validateSelection treats PW and new types as mandatory", () => {
  it("requires all core courses (incl. PW) to be selected", () => {
    const available = [
      { id: "c1", courseType: "PC" },
      { id: "c2", courseType: "PW" },
      { id: "c3", courseType: "ETC" },
      { id: "c4", courseType: "PE" },
    ];
    expect(() =>
      coreRegistrationStrategy.validateSelection(
        available as never,
        ["c2", "c3", "c4"],
        {} as never
      )
    ).toThrow("All mandatory core courses must be included");

    expect(() =>
      coreRegistrationStrategy.validateSelection(
        available as never,
        ["c1", "c2", "c3", "c4"],
        {} as never
      )
    ).not.toThrow();
  });
});
