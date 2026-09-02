/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { preferAttemptScopedAssessments } from "../assessment-aggregation.loader";

type Row = {
  id: string;
  studentId: string;
  assessmentId: string;
  totalMarks: number;
  status: string;
  courseRegistrationId: string | null;
};

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "row-1",
    studentId: "student-1",
    assessmentId: "assessment-1",
    totalMarks: 10,
    status: "PRESENT",
    courseRegistrationId: null,
    ...overrides,
  };
}

describe("preferAttemptScopedAssessments", () => {
  it("returns a single row untouched", () => {
    const rows = [makeRow()];
    expect(preferAttemptScopedAssessments(rows)).toEqual(rows);
  });

  it("prefers an attempt-pinned row over a legacy null-pinned row", () => {
    const legacy = makeRow({ id: "row-legacy" });
    const pinned = makeRow({
      id: "row-pinned",
      courseRegistrationId: "reg-2",
      totalMarks: 18,
    });
    const result = preferAttemptScopedAssessments([pinned, legacy]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("row-pinned");
  });

  it("breaks ties between two pinned rows by newest id", () => {
    const older = makeRow({
      id: "reg-1",
      courseRegistrationId: "reg-1",
      totalMarks: 8,
    });
    const newer = makeRow({
      id: "reg-9",
      courseRegistrationId: "reg-9",
      totalMarks: 15,
    });
    const result = preferAttemptScopedAssessments([older, newer]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("reg-9");
  });

  it("prefers the row pinned to the student's current attempt over another pinned row regardless of id order", () => {
    const current = makeRow({
      id: "row-current",
      courseRegistrationId: "reg-active",
      totalMarks: 16,
    });
    const historical = makeRow({
      id: "row-zzz-historical",
      courseRegistrationId: "reg-superseded",
      totalMarks: 5,
      status: "ABSENT",
    });
    const preferred = new Map([["student-1", "reg-active"]]);
    for (const ordering of [
      [current, historical],
      [historical, current],
    ]) {
      const result = preferAttemptScopedAssessments(ordering, preferred);
      expect(result).toHaveLength(1);
      expect(result[0]?.totalMarks).toBe(16);
    }
  });

  it("keeps pinned-vs-pinned id tie-break when no preference is provided", () => {
    const lowId = makeRow({
      id: "row-a-low",
      courseRegistrationId: "reg-1",
      totalMarks: 8,
    });
    const highId = makeRow({
      id: "row-b-high",
      courseRegistrationId: "reg-2",
      totalMarks: 15,
    });
    const result = preferAttemptScopedAssessments([highId, lowId]);
    expect(result[0]?.totalMarks).toBe(15);
  });

  it("falls back to pin preference when the student has no preferred registration", () => {
    const legacy = makeRow({ id: "row-legacy", totalMarks: 5 });
    const pinned = makeRow({
      id: "row-pinned",
      courseRegistrationId: "reg-7",
      totalMarks: 14,
    });
    const result = preferAttemptScopedAssessments([pinned, legacy], new Map());
    expect(result[0]?.totalMarks).toBe(14);
  });

  it("keeps distinct assessments of the same student separate", () => {
    const first = makeRow({ id: "row-a", assessmentId: "assessment-1" });
    const second = makeRow({ id: "row-b", assessmentId: "assessment-2" });
    const result = preferAttemptScopedAssessments([first, second]);
    expect(result).toHaveLength(2);
  });

  it("keeps different students independent", () => {
    const one = makeRow({ id: "row-a", studentId: "student-1" });
    const two = makeRow({ id: "row-b", studentId: "student-2" });
    const result = preferAttemptScopedAssessments([one, two]);
    expect(result).toHaveLength(2);
  });

  it("dedupes within each student independently", () => {
    const s1Legacy = makeRow({
      id: "a-legacy",
      studentId: "s1",
      totalMarks: 5,
    });
    const s1Pinned = makeRow({
      id: "a-pinned",
      studentId: "s1",
      courseRegistrationId: "reg-3",
      totalMarks: 12,
    });
    const s2Pinned = makeRow({
      id: "b-pinned",
      studentId: "s2",
      courseRegistrationId: "reg-4",
      totalMarks: 20,
    });
    const result = preferAttemptScopedAssessments([
      s1Legacy,
      s2Pinned,
      s1Pinned,
    ]);
    expect(result).toHaveLength(2);
    const byStudent = new Map(result.map((row) => [row.studentId, row]));
    expect(byStudent.get("s1")?.totalMarks).toBe(12);
    expect(byStudent.get("s2")?.totalMarks).toBe(20);
  });
});
