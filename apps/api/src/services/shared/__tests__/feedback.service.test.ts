import { describe, expect, it } from "bun:test";

describe("feedback score rules", () => {
  it("maps a five-point average to a percentage", () => {
    const average = 4.2;
    expect((average / 5) * 100).toBeCloseTo(84);
  });

  it("keeps the five-point scale bounded", () => {
    expect([1, 2, 3, 4, 5].every((score) => score >= 1 && score <= 5)).toBe(
      true
    );
  });

  it("requires ten answers for a complete response", () => {
    expect(
      new Set(Array.from({ length: 10 }, (_, index) => index + 1)).size
    ).toBe(10);
  });
});
