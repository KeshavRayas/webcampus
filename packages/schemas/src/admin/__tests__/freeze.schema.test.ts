import { describe, expect, it } from "bun:test";
import {
  AdminBulkFreezeSchema,
  AdminBulkUnfreezeSchema,
} from "../freeze.schema";

const target = {
  courseAssignmentId: "00000000-0000-4000-8000-000000000001",
};

const payload = {
  academicTermId: "00000000-0000-4000-8000-000000000002",
  semesterId: "00000000-0000-4000-8000-000000000003",
  targets: [target],
};

describe("admin bulk freeze schemas", () => {
  it("accepts explicit filtered regular and elective targets", () => {
    expect(
      AdminBulkFreezeSchema.parse({
        ...payload,
        targets: [
          target,
          {
            electiveBatchFacultyId: "00000000-0000-4000-8000-000000000004",
          },
        ],
      }).targets
    ).toHaveLength(2);
    expect(AdminBulkUnfreezeSchema.parse(payload).targets).toHaveLength(1);
  });

  it("requires at least one target", () => {
    expect(() =>
      AdminBulkFreezeSchema.parse({ ...payload, targets: [] })
    ).toThrow();
  });
});
