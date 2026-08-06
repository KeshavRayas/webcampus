import { describe, expect, it } from "bun:test";
import { roundStatus } from "../feedback.service";

const baseRound = {
  isEnabled: true,
  startsAt: new Date("2026-01-01T00:00:00Z"),
  endsAt: new Date("2026-01-31T00:00:00Z"),
};

describe("feedback roundStatus", () => {
  it("marks a disabled round DISABLED regardless of dates", () => {
    expect(
      roundStatus({ ...baseRound, isEnabled: false }, new Date("2026-01-15"))
    ).toBe("DISABLED");
  });

  it("marks a round before its start UPCOMING", () => {
    expect(roundStatus(baseRound, new Date("2025-12-31T23:59:59Z"))).toBe(
      "UPCOMING"
    );
  });

  it("marks a round within its window ONGOING", () => {
    expect(roundStatus(baseRound, new Date("2026-01-15T12:00:00Z"))).toBe(
      "ONGOING"
    );
  });

  it("marks a round after its end COMPLETED", () => {
    expect(roundStatus(baseRound, new Date("2026-02-01T00:00:00Z"))).toBe(
      "COMPLETED"
    );
  });
});
