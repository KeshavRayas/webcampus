import { describe, expect, test } from "bun:test";
import {
  buildQuestionMarkUpsert,
  chunk,
  type QuestionMarkRow,
} from "./populate-batch";

describe("chunk", () => {
  test("splits into even-sized chunks with a remainder", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("returns empty array for empty input", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  test("returns one chunk when size >= length", () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });

  test("rejects non-positive size", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe("buildQuestionMarkUpsert", () => {
  const rows: QuestionMarkRow[] = [
    { id: "r1", recordId: "sa1", questionId: "q1", marksObtained: 4 },
    { id: "r2", recordId: "sa1", questionId: "q2", marksObtained: 2.5 },
  ];

  test("builds one parameterized upsert statement", () => {
    const { sql, params } = buildQuestionMarkUpsert(rows);
    expect(sql).toContain('INSERT INTO "StudentQuestionMark"');
    expect(sql).toContain('ON CONFLICT ("recordId", "questionId")');
    expect(sql).toContain(
      'DO UPDATE SET "marksObtained" = EXCLUDED."marksObtained"'
    );
    expect(params).toEqual(["r1", "sa1", "q1", 4, "r2", "sa1", "q2", 2.5]);
  });

  test("numbers placeholders sequentially ($1..$8 for two rows)", () => {
    const { sql } = buildQuestionMarkUpsert(rows);
    expect(sql.match(/\$\d+/g)).toEqual([
      "$1",
      "$2",
      "$3",
      "$4",
      "$5",
      "$6",
      "$7",
      "$8",
    ]);
  });

  test("throws on empty input", () => {
    expect(() => buildQuestionMarkUpsert([])).toThrow();
  });
});
