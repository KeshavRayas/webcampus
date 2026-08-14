import { describe, expect, it } from "bun:test";
import {
  buildDomainOptions,
  deriveCourseFilterDomain,
  type DomainKind,
  type DomainSourceAssignment,
} from "../filter-domain";

type Assignment = DomainSourceAssignment & {
  course: DomainSourceAssignment["course"] & {
    code: string;
    courseType: string;
  };
};

const termId = "term-1";
const semesterId = "sem-1";

const make = (
  course: { id: string; code: string; courseType: string },
  section: { id: string; name: string } | null,
  batch: { id: string; name: string } | null
): Assignment => ({
  course: {
    id: course.id,
    code: course.code,
    courseType: course.courseType,
    semester: { id: semesterId, academicTerm: { id: termId } },
  },
  section,
  electiveBatchId: batch?.id ?? null,
  electiveBatchName: batch?.name ?? null,
});
const C1 = { id: "c1", code: "C1", courseType: "PC" };
const C2 = { id: "c2", code: "C2", courseType: "PC" };
const E1 = { id: "e1", code: "E1", courseType: "PE" };
const E2 = { id: "e2", code: "E2", courseType: "PE" };
const O1 = { id: "o1", code: "O1", courseType: "OE" };
const P1 = { id: "p1", code: "P1", courseType: "PW" };
const P2 = { id: "p2", code: "P2", courseType: "PW" };

const FACULTY_ASSIGNMENTS: Assignment[] = [
  make(C1, { id: "s-11", name: "C11" }, null),
  make(C1, { id: "s-12", name: "C12" }, null),
  make(C2, { id: "s-21", name: "C21" }, null),
  make(C2, { id: "s-22", name: "C22" }, null),
  make(E1, null, { id: "b-1", name: "B1" }),
  make(E1, null, { id: "b-2", name: "B2" }),
  make(E2, null, { id: "b-3", name: "B3" }),
  make(E2, null, { id: "b-4", name: "B4" }),
  make(O1, null, { id: "b-5", name: "B5" }),
  make(P1, null, { id: "g-1", name: "G-001" }),
  make(P1, null, { id: "g-2", name: "G-002" }),
  make(P2, null, { id: "g-3", name: "G-003" }),
  make(P2, null, { id: "g-4", name: "G-004" }),
];

const domainKindFor = (domain: string): DomainKind =>
  domain === "section" ? "section" : "batch";

const domainOptionsFor = (course: { id: string; courseType: string }) => {
  const domain = deriveCourseFilterDomain(course.courseType);
  if (!domain) return { domain, labels: [] as string[] };
  const options = buildDomainOptions(
    FACULTY_ASSIGNMENTS,
    { termId, semesterId, courseId: course.id },
    domainKindFor(domain)
  );
  return { domain, labels: options.map((o) => o.label) };
};

describe("marks domain scoping — mandatory regression dataset", () => {
  it("C1 (PC) exposes only its own sections", () => {
    expect(domainOptionsFor(C1)).toEqual({
      domain: "section",
      labels: ["C11", "C12"],
    });
  });

  it("C2 (PC) exposes only its own sections", () => {
    expect(domainOptionsFor(C2)).toEqual({
      domain: "section",
      labels: ["C21", "C22"],
    });
  });

  it("E1 (PE) exposes only its own batches", () => {
    expect(domainOptionsFor(E1)).toEqual({
      domain: "batch",
      labels: ["B1", "B2"],
    });
  });

  it("E2 (PE) exposes only its own batches", () => {
    expect(domainOptionsFor(E2)).toEqual({
      domain: "batch",
      labels: ["B3", "B4"],
    });
  });

  it("O1 (OE) exposes only its own batch", () => {
    expect(domainOptionsFor(O1)).toEqual({
      domain: "batch",
      labels: ["B5"],
    });
  });

  it("P1 (PW) exposes only its own groups", () => {
    expect(domainOptionsFor(P1)).toEqual({
      domain: "group",
      labels: ["G-001", "G-002"],
    });
  });

  it("P2 (PW) exposes only its own groups", () => {
    expect(domainOptionsFor(P2)).toEqual({
      domain: "group",
      labels: ["G-003", "G-004"],
    });
  });

  it("selecting C1 never exposes C2 sections", () => {
    const { labels } = domainOptionsFor(C1);
    expect(labels).not.toContain("C21");
    expect(labels).not.toContain("C22");
  });

  it("selecting E1 never exposes E2/O1 batches", () => {
    const { labels } = domainOptionsFor(E1);
    expect(labels).not.toContain("B3");
    expect(labels).not.toContain("B4");
    expect(labels).not.toContain("B5");
  });

  it("selecting P1 never exposes P2 groups", () => {
    const { labels } = domainOptionsFor(P1);
    expect(labels).not.toContain("G-003");
    expect(labels).not.toContain("G-004");
  });

  it("reproduces the C3 screenshot failure — PW course groups only, no foreign batches", () => {
    const pw = { id: "c3", code: "C3", courseType: "PW" };
    const assignments: Assignment[] = [
      make({ id: "c1", code: "C1", courseType: "PW" }, null, {
        id: "b-11",
        name: "C11",
      }),
      make({ id: "c1", code: "C1", courseType: "PW" }, null, {
        id: "b-12",
        name: "C12",
      }),
      make({ id: "c2", code: "C2", courseType: "PW" }, null, {
        id: "b-21",
        name: "C21",
      }),
      make({ id: "c2", code: "C2", courseType: "PW" }, null, {
        id: "b-22",
        name: "C22",
      }),
      make(pw, null, { id: "g-1", name: "G-001" }),
      make(pw, null, { id: "g-2", name: "G-002" }),
      make(pw, null, { id: "g-3", name: "G-003" }),
    ];
    const options = buildDomainOptions(
      assignments,
      { termId, semesterId, courseId: pw.id },
      "batch"
    );
    const labels = options.map((o) => o.label);
    expect(labels).toEqual(["G-001", "G-002", "G-003"]);
    expect(labels).not.toContain("C11");
    expect(labels).not.toContain("C12");
    expect(labels).not.toContain("C21");
    expect(labels).not.toContain("C22");
  });
});

describe("marks domain course-switch — stale domain cleared", () => {
  const optionsFor = (courseId: string, kind: DomainKind) =>
    buildDomainOptions(
      FACULTY_ASSIGNMENTS,
      { termId, semesterId, courseId },
      kind
    ).map((o) => o.label);

  it("PC → PW: section domain gives way to group domain, old section gone", () => {
    const pcSections = optionsFor("c1", "section");
    const pwGroups = optionsFor("p1", "batch");
    expect(pcSections).toEqual(["C11", "C12"]);
    expect(pwGroups).toEqual(["G-001", "G-002"]);
    expect(pwGroups).not.toContain("C11");
  });

  it("PW → PC: group domain gives way to section domain, old group gone", () => {
    const pwGroups = optionsFor("p1", "batch");
    const pcSections = optionsFor("c1", "section");
    expect(pwGroups).toEqual(["G-001", "G-002"]);
    expect(pcSections).toEqual(["C11", "C12"]);
    expect(pcSections).not.toContain("G-001");
  });

  it("PE → PW: batch domain stays but options revalidate against the new course", () => {
    const peBatches = optionsFor("e1", "batch");
    const pwGroups = optionsFor("p1", "batch");
    expect(peBatches).toEqual(["B1", "B2"]);
    expect(pwGroups).toEqual(["G-001", "G-002"]);
    expect(pwGroups).not.toContain("B1");
  });

  it("PW → OE: group domain becomes batch domain, options revalidated", () => {
    const pwGroups = optionsFor("p1", "batch");
    const oeBatches = optionsFor("o1", "batch");
    expect(pwGroups).toEqual(["G-001", "G-002"]);
    expect(oeBatches).toEqual(["B5"]);
    expect(oeBatches).not.toContain("G-001");
  });

  it("OE → PE: batch domain preserved, options belong only to new course", () => {
    const oeBatches = optionsFor("o1", "batch");
    const peBatches = optionsFor("e2", "batch");
    expect(oeBatches).toEqual(["B5"]);
    expect(peBatches).toEqual(["B3", "B4"]);
    expect(peBatches).not.toContain("B5");
  });
});
