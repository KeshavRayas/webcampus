import { describe, expect, it } from "bun:test";
import {
  buildDomainOptions,
  deriveCourseFilterDomain,
  DOMAIN_ALL_LABELS,
  DOMAIN_LABELS,
  isBatchManagedCourseType,
  type DomainSourceAssignment,
} from "../filter-domain";

describe("deriveCourseFilterDomain", () => {
  it("maps PC to section", () => {
    expect(deriveCourseFilterDomain("PC")).toBe("section");
  });

  it("maps NCMC to section", () => {
    expect(deriveCourseFilterDomain("NCMC")).toBe("section");
  });

  it("maps PE to batch", () => {
    expect(deriveCourseFilterDomain("PE")).toBe("batch");
  });

  it("maps OE to batch", () => {
    expect(deriveCourseFilterDomain("OE")).toBe("batch");
  });

  it("maps PW to group", () => {
    expect(deriveCourseFilterDomain("PW")).toBe("group");
  });

  it("returns null for unknown or missing course types", () => {
    expect(deriveCourseFilterDomain(undefined)).toBeNull();
    expect(deriveCourseFilterDomain(null)).toBeNull();
    expect(deriveCourseFilterDomain("")).toBeNull();
    expect(deriveCourseFilterDomain("CC")).toBeNull();
  });

  it("never maps PC/NCMC to batch or group", () => {
    expect(deriveCourseFilterDomain("PC")).not.toBe("batch");
    expect(deriveCourseFilterDomain("PC")).not.toBe("group");
    expect(deriveCourseFilterDomain("NCMC")).not.toBe("batch");
    expect(deriveCourseFilterDomain("NCMC")).not.toBe("group");
  });
});

describe("isBatchManagedCourseType", () => {
  it("returns true for PE, OE, PW", () => {
    expect(isBatchManagedCourseType("PE")).toBe(true);
    expect(isBatchManagedCourseType("OE")).toBe(true);
    expect(isBatchManagedCourseType("PW")).toBe(true);
  });

  it("returns false for PC, NCMC and missing types", () => {
    expect(isBatchManagedCourseType("PC")).toBe(false);
    expect(isBatchManagedCourseType("NCMC")).toBe(false);
    expect(isBatchManagedCourseType(undefined)).toBe(false);
    expect(isBatchManagedCourseType(null)).toBe(false);
  });
});

describe("domain label maps", () => {
  it("exposes section, batch and group labels", () => {
    expect(DOMAIN_LABELS.section).toBe("Section");
    expect(DOMAIN_LABELS.batch).toBe("Batch");
    expect(DOMAIN_LABELS.group).toBe("Group");
    expect(DOMAIN_ALL_LABELS.section).toBe("All sections");
    expect(DOMAIN_ALL_LABELS.batch).toBe("All batches");
    expect(DOMAIN_ALL_LABELS.group).toBe("All groups");
  });
});

describe("buildDomainOptions", () => {
  const assignment = (
    courseId: string,
    termId: string,
    semesterId: string,
    section: { id: string; name: string } | null,
    batch: { id: string; name: string } | null
  ): DomainSourceAssignment => ({
    course: {
      id: courseId,
      semester: { id: semesterId, academicTerm: { id: termId } },
    },
    section,
    electiveBatchId: batch?.id ?? null,
    electiveBatchName: batch?.name ?? null,
  });

  const termId = "term-1";
  const semesterId = "sem-1";

  it("returns only the selected course's sections", () => {
    const assignments = [
      assignment("c1", termId, semesterId, { id: "s-11", name: "C11" }, null),
      assignment("c1", termId, semesterId, { id: "s-12", name: "C12" }, null),
      assignment("c2", termId, semesterId, { id: "s-21", name: "C21" }, null),
      assignment("c2", termId, semesterId, { id: "s-22", name: "C22" }, null),
    ];
    const result = buildDomainOptions(
      assignments,
      { termId, semesterId, courseId: "c1" },
      "section"
    );
    expect(result.map((o) => o.label)).toEqual(["C11", "C12"]);
  });

  it("never leaks another course's sections", () => {
    const assignments = [
      assignment("c1", termId, semesterId, { id: "s-11", name: "C11" }, null),
      assignment("c2", termId, semesterId, { id: "s-21", name: "C21" }, null),
    ];
    const result = buildDomainOptions(
      assignments,
      { termId, semesterId, courseId: "c2" },
      "section"
    );
    expect(result.map((o) => o.label)).toEqual(["C21"]);
  });

  it("returns only the selected PE course's batches", () => {
    const assignments = [
      assignment("e1", termId, semesterId, null, { id: "b-1", name: "B1" }),
      assignment("e1", termId, semesterId, null, { id: "b-2", name: "B2" }),
      assignment("e2", termId, semesterId, null, { id: "b-3", name: "B3" }),
      assignment("o1", termId, semesterId, null, { id: "b-5", name: "B5" }),
    ];
    const result = buildDomainOptions(
      assignments,
      { termId, semesterId, courseId: "e1" },
      "batch"
    );
    expect(result.map((o) => o.label)).toEqual(["B1", "B2"]);
  });

  it("returns only the selected PW course's groups", () => {
    const assignments = [
      assignment("p1", termId, semesterId, null, { id: "g-1", name: "G-001" }),
      assignment("p1", termId, semesterId, null, { id: "g-2", name: "G-002" }),
      assignment("p2", termId, semesterId, null, { id: "g-3", name: "G-003" }),
      assignment("p2", termId, semesterId, null, { id: "g-4", name: "G-004" }),
    ];
    const result = buildDomainOptions(
      assignments,
      { termId, semesterId, courseId: "p1" },
      "batch"
    );
    expect(result.map((o) => o.label)).toEqual(["G-001", "G-002"]);
  });

  it("never leaks another course's batches or groups", () => {
    const assignments = [
      assignment("p1", termId, semesterId, null, { id: "g-1", name: "G-001" }),
      assignment("p2", termId, semesterId, null, { id: "g-3", name: "G-003" }),
      assignment("e2", termId, semesterId, null, { id: "b-3", name: "B3" }),
    ];
    const result = buildDomainOptions(
      assignments,
      { termId, semesterId, courseId: "p2" },
      "batch"
    );
    expect(result.map((o) => o.label)).toEqual(["G-003"]);
  });

  it("scopes by term and semester as well as course", () => {
    const assignments = [
      assignment("c1", termId, semesterId, { id: "s-11", name: "C11" }, null),
      assignment("c1", "term-2", semesterId, { id: "s-99", name: "C99" }, null),
      assignment("c1", termId, "sem-2", { id: "s-88", name: "C88" }, null),
    ];
    const result = buildDomainOptions(
      assignments,
      { termId, semesterId, courseId: "c1" },
      "section"
    );
    expect(result.map((o) => o.label)).toEqual(["C11"]);
  });

  it("dedupes deterministically by record id, not label", () => {
    const assignments = [
      assignment("c1", termId, semesterId, { id: "s-11", name: "C11" }, null),
      assignment(
        "c1",
        termId,
        semesterId,
        { id: "s-11", name: "Renamed" },
        null
      ),
    ];
    const result = buildDomainOptions(
      assignments,
      { termId, semesterId, courseId: "c1" },
      "section"
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe("s-11");
  });

  it("returns an empty array when no course is selected", () => {
    const assignments = [
      assignment("c1", termId, semesterId, { id: "s-11", name: "C11" }, null),
    ];
    const result = buildDomainOptions(
      assignments,
      { termId, semesterId, courseId: "" },
      "section"
    );
    expect(result).toEqual([]);
  });

  it("ignores assignments with no matching domain record", () => {
    const assignments = [assignment("c1", termId, semesterId, null, null)];
    const sections = buildDomainOptions(
      assignments,
      { termId, semesterId, courseId: "c1" },
      "section"
    );
    const batches = buildDomainOptions(
      assignments,
      { termId, semesterId, courseId: "c1" },
      "batch"
    );
    expect(sections).toEqual([]);
    expect(batches).toEqual([]);
  });
});
