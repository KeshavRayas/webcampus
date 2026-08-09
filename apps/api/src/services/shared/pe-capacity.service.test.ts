import { describe, expect, test } from "bun:test";
import { isPeFull, peCourseCapacity, seatsLeft } from "./pe-capacity.service";

describe("peCourseCapacity helpers", () => {
  test("computes capacity as batches × studentsPerBatch", () => {
    expect(peCourseCapacity(4, 30)).toBe(120);
    expect(peCourseCapacity(1, 1)).toBe(1);
  });

  test("treats null/undefined as zero capacity", () => {
    expect(peCourseCapacity(null, 30)).toBe(0);
    expect(peCourseCapacity(4, undefined)).toBe(0);
  });

  test("seatsLeft never goes negative", () => {
    expect(seatsLeft(120, 42)).toBe(78);
    expect(seatsLeft(120, 120)).toBe(0);
    expect(seatsLeft(120, 150)).toBe(0);
  });

  test("isPeFull is true at and above capacity when capacity > 0", () => {
    expect(isPeFull(120, 119)).toBe(false);
    expect(isPeFull(120, 120)).toBe(true);
    expect(isPeFull(120, 121)).toBe(true);
  });

  test("isPeFull is total over the capacity domain (capacity 0 is always full)", () => {
    expect(isPeFull(0, 0)).toBe(true);
    expect(isPeFull(0, 5)).toBe(true);
    expect(isPeFull(1, 1)).toBe(true);
    expect(isPeFull(1, 0)).toBe(false);
  });
});
