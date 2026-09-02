import { describe, expect, it } from "bun:test";
import {
  buildReappearPapers,
  type BacklogPaperRow,
  type ReappearExamRegistrationRow,
} from "../hall-ticket.service";

function makeSuppRow(overrides?: Partial<BacklogPaperRow>): BacklogPaperRow {
  return {
    id: overrides?.id ?? "supp-reg-1",
    courseId: overrides?.courseId ?? "course-9",
    course: overrides?.course ?? {
      code: "CS301",
      name: "Networks",
      courseType: "THEORY",
      totalCredits: 3,
    },
  };
}

function makeRow(
  overrides?: Partial<ReappearExamRegistrationRow>
): ReappearExamRegistrationRow {
  return {
    id: overrides?.id ?? "exam-1",
    courseId: overrides?.courseId ?? "course-1",
    attemptNumber: overrides?.attemptNumber ?? 2,
    course: overrides?.course ?? {
      code: "CS201",
      name: "Data Structures",
      courseType: "THEORY",
      totalCredits: 4,
    },
  };
}

describe("buildReappearPapers", () => {
  it("maps exam registration rows to backlog paper items", () => {
    const papers = buildReappearPapers([makeRow()], new Set());
    expect(papers).toHaveLength(1);
    const paper = papers[0];
    if (!paper) throw new Error("expected paper");
    expect(paper.courseAssignmentId).toBe("exam-1");
    expect(paper.courseCode).toBe("CS201");
    expect(paper.courseName).toBe("Data Structures");
    expect(paper.courseType).toBe("THEORY");
    expect(paper.credits).toBe(4);
    expect(paper.cieTotal).toBeNull();
    expect(paper.attendancePercentage).toBeNull();
    expect(paper.isFrozen).toBe(true);
    expect(paper.markEligible).toBe(true);
    expect(paper.attendanceEligible).toBe(true);
    expect(paper.eligible).toBe(true);
    expect(paper.reason).toBeNull();
    expect(paper.isBacklog).toBe(true);
  });

  it("skips courses already present in current registrations", () => {
    const papers = buildReappearPapers([makeRow()], new Set(["course-1"]));
    expect(papers).toHaveLength(0);
  });

  it("keeps only non-excluded rows and preserves row order", () => {
    const rows = [
      makeRow({ id: "exam-1", courseId: "course-1" }),
      makeRow({
        id: "exam-2",
        courseId: "course-2",
        course: {
          code: "MA201",
          name: "Maths",
          courseType: "THEORY",
          totalCredits: 3,
        },
      }),
      makeRow({ id: "exam-3", courseId: "course-3" }),
    ];
    const papers = buildReappearPapers(rows, new Set(["course-1", "course-3"]));
    expect(papers).toHaveLength(1);
    const paper = papers[0];
    if (!paper) throw new Error("expected paper");
    expect(paper.courseAssignmentId).toBe("exam-2");
    expect(paper.courseCode).toBe("MA201");
  });

  it("returns empty array for no rows", () => {
    expect(buildReappearPapers([], new Set())).toEqual([]);
  });

  it("accepts supplementary registration rows without attemptNumber", () => {
    const papers = buildReappearPapers([makeSuppRow()], new Set());
    expect(papers).toHaveLength(1);
    const paper = papers[0];
    if (!paper) throw new Error("expected paper");
    expect(paper.courseAssignmentId).toBe("supp-reg-1");
    expect(paper.courseCode).toBe("CS301");
    expect(paper.credits).toBe(3);
    expect(paper.isBacklog).toBe(true);
  });

  it("merges reappear and supplementary rows with reappear first, deduped via exclude set", () => {
    const rows = [
      makeRow({ id: "exam-1", courseId: "course-1" }),
      makeSuppRow({ id: "supp-reg-2", courseId: "course-2" }),
      makeSuppRow({ id: "supp-reg-3", courseId: "course-1" }),
    ];
    const papers = buildReappearPapers(rows, new Set(["course-1"]));
    expect(papers).toHaveLength(1);
    expect(papers[0]?.courseAssignmentId).toBe("supp-reg-2");
    expect(papers[0]?.courseCode).toBe("CS301");
  });
});
