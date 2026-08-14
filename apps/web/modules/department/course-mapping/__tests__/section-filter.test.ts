import { describe, expect, test } from "bun:test";
import {
  ALL_SECTIONS,
  filterMappingsBySection,
  getSectionOptions,
  SectionFilterMapping,
} from "../section-filter";

function mapping(
  id: string,
  name: string,
  sectionName: string | null,
  facultyId: string | null = null
): SectionFilterMapping {
  return {
    electiveBatchId: id,
    electiveBatchName: name,
    sectionName,
    facultyId,
    proposedFacultyId: null,
  };
}

describe("getSectionOptions", () => {
  test("returns unique sorted non-null section names", () => {
    const mappings = [
      mapping("1", "G-001", "PB"),
      mapping("2", "G-002", "PA"),
      mapping("3", "G-003", "PB"),
      mapping("4", "G-004", null),
    ];
    expect(getSectionOptions(mappings)).toEqual(["PA", "PB"]);
  });

  test("returns empty array when no mappings have sections", () => {
    expect(getSectionOptions([mapping("1", "G-001", null)])).toEqual([]);
    expect(getSectionOptions([])).toEqual([]);
  });
});

describe("filterMappingsBySection", () => {
  const mappings = [
    mapping("1", "G-001", "PA"),
    mapping("2", "G-002", "PA"),
    mapping("3", "G-003", "PB"),
  ];

  test("ALL_SECTIONS returns the same array reference (full state)", () => {
    expect(filterMappingsBySection(mappings, ALL_SECTIONS)).toBe(mappings);
  });

  test("filters to the requested section only", () => {
    const visible = filterMappingsBySection(mappings, "PA");
    expect(visible.map((m) => m.electiveBatchName)).toEqual(["G-001", "G-002"]);
  });

  test("returns empty array when no groups match the section", () => {
    expect(filterMappingsBySection(mappings, "ZZ")).toEqual([]);
  });

  test("returns the same array reference on empty mappings", () => {
    expect(filterMappingsBySection([], ALL_SECTIONS)).toEqual([]);
  });
});

describe("100-group scenario (10 sections x 10 groups)", () => {
  const sections = ["PA", "PB", "PC", "PD", "PE", "PF", "PG", "PH", "PI", "PJ"];
  const allMappings: SectionFilterMapping[] = [];
  for (let i = 0; i < sections.length; i++) {
    for (let j = 1; j <= 10; j++) {
      const groupNumber = i * 10 + j;
      allMappings.push(
        mapping(
          `eb-${groupNumber}`,
          `G-${groupNumber.toString().padStart(3, "0")}`,
          sections[i] ?? null,
          `f-${groupNumber}`
        )
      );
    }
  }

  test("all 100 groups exist in the complete state", () => {
    expect(allMappings).toHaveLength(100);
    expect(getSectionOptions(allMappings)).toEqual(sections);
  });

  test("filtering PA shows exactly the 10 PA groups only", () => {
    const visible = filterMappingsBySection(allMappings, "PA");
    expect(visible).toHaveLength(10);
    expect(visible.every((m) => m.sectionName === "PA")).toBe(true);
    expect(visible[0]?.electiveBatchName).toBe("G-001");
    expect(visible[9]?.electiveBatchName).toBe("G-010");
  });

  test("ALL_SECTIONS retains all 100 groups with complete faculty state", () => {
    const full = filterMappingsBySection(allMappings, ALL_SECTIONS);
    expect(full).toHaveLength(100);
    expect(full.every((m) => m.facultyId !== null)).toBe(true);
  });

  test("unmapped hidden-section group is still part of the authoritative state", () => {
    const withGap = allMappings.map((m) =>
      m.electiveBatchName === "G-014" ? { ...m, facultyId: null } : m
    );
    const visible = filterMappingsBySection(withGap, "PA");
    expect(visible).toHaveLength(10);
    expect(visible.every((m) => m.facultyId !== null)).toBe(true);
    const full = filterMappingsBySection(withGap, ALL_SECTIONS);
    const g014 = full.find((m) => m.electiveBatchName === "G-014");
    expect(g014?.facultyId).toBeNull();
  });
});
