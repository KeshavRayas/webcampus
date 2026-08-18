import { describe, expect, it } from "bun:test";
import { pickLeastOccupiedBatch } from "../backfill-course-registration.utils";

describe("pickLeastOccupiedBatch", () => {
  it("selects the least-filled available group", () => {
    const batches = [
      { id: "group-1", sortOrder: 1 },
      { id: "group-2", sortOrder: 2 },
      { id: "group-3", sortOrder: 3 },
    ];
    const counts = new Map([
      ["group-1", 2],
      ["group-2", 0],
      ["group-3", 1],
    ]);

    expect(pickLeastOccupiedBatch(batches, counts, 2)?.id).toBe("group-2");
  });

  it("uses sort order as a deterministic tie-breaker and respects capacity", () => {
    const batches = [
      { id: "group-2", sortOrder: 2 },
      { id: "group-1", sortOrder: 1 },
    ];
    const counts = new Map([
      ["group-1", 1],
      ["group-2", 1],
    ]);

    expect(pickLeastOccupiedBatch(batches, counts, 1)).toBeUndefined();
    expect(pickLeastOccupiedBatch(batches, counts, 2)?.id).toBe("group-1");
  });
});
