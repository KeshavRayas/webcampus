import { describe, expect, it } from "bun:test";
import { PeCapacityService } from "../pe-capacity.service";

type FakeTx = {
  course: {
    findUnique: (args: {
      where: { id: string };
      select: { courseType: boolean; code: boolean };
    }) => Promise<{ courseType: string; code: string } | null>;
  };
  electiveBatch: {
    findMany: () => Promise<Array<{ id: string; facultyAssignment: null }>>;
  };
  courseRegistration: {
    findMany: () => Promise<Array<{ studentId: string }>>;
  };
  electiveStudentAssignment: {
    count: () => Promise<number>;
  };
};

function buildTx(course: { courseType: string; code: string } | null): FakeTx {
  return {
    course: {
      findUnique: async () => course,
    },
    electiveBatch: {
      findMany: async () => [{ id: "g1", facultyAssignment: null }],
    },
    courseRegistration: {
      findMany: async () => [{ studentId: "s1" }],
    },
    electiveStudentAssignment: {
      count: async () => 0,
    },
  };
}

describe("downstream readiness gate (assertPeDownstreamReady) across course types", () => {
  it("PE course is gated when faculty/student mapping is incomplete", async () => {
    const tx = buildTx({ courseType: "PE", code: "PE101" });
    await expect(
      PeCapacityService.assertPeDownstreamReady("c1", tx as never)
    ).rejects.toThrow(
      "PE course PE101 requires both faculty mapping and student mapping before attendance, marks, or hall tickets."
    );
  });

  it("PW course is gated like PE (positive: PW blocked when incomplete)", async () => {
    const tx = buildTx({ courseType: "PW", code: "PW500" });
    await expect(
      PeCapacityService.assertPeDownstreamReady("c1", tx as never)
    ).rejects.toThrow(
      "Project / Mini-Project (PW) course PW500 requires both faculty mapping and student mapping before attendance, marks, or hall tickets."
    );
  });

  it("PC course is NOT gated (existing behavior preserved)", async () => {
    const tx = buildTx({ courseType: "PC", code: "PC101" });
    await expect(
      PeCapacityService.assertPeDownstreamReady("c1", tx as never)
    ).resolves.toBeUndefined();
  });

  it("OE course is NOT gated (existing behavior preserved)", async () => {
    const tx = buildTx({ courseType: "OE", code: "OE101" });
    await expect(
      PeCapacityService.assertPeDownstreamReady("c1", tx as never)
    ).resolves.toBeUndefined();
  });

  it("missing course is NOT gated", async () => {
    const tx = buildTx(null);
    await expect(
      PeCapacityService.assertPeDownstreamReady("c1", tx as never)
    ).resolves.toBeUndefined();
  });

  it("PE course passes the gate when faculty and student mapping are complete", async () => {
    const tx = {
      course: {
        findUnique: async () => ({ courseType: "PE", code: "PE101" }),
      },
      electiveBatch: {
        findMany: async () => [
          {
            id: "g1",
            facultyAssignment: {
              id: "fa1",
              semester: 8,
              academicYear: "2026",
            },
          },
        ],
      },
      courseRegistration: {
        findMany: async () => [{ studentId: "s1" }],
      },
      electiveStudentAssignment: {
        count: async () => 1,
      },
    };
    await expect(
      PeCapacityService.assertPeDownstreamReady("c1", tx as never)
    ).resolves.toBeUndefined();
  });

  it("PW course passes the gate when faculty and student mapping are complete", async () => {
    const tx = {
      course: {
        findUnique: async () => ({ courseType: "PW", code: "PW500" }),
      },
      electiveBatch: {
        findMany: async () => [
          {
            id: "g1",
            facultyAssignment: {
              id: "fa1",
              semester: 8,
              academicYear: "2026",
            },
          },
        ],
      },
      courseRegistration: {
        findMany: async () => [{ studentId: "s1" }],
      },
      electiveStudentAssignment: {
        count: async () => 1,
      },
    };
    await expect(
      PeCapacityService.assertPeDownstreamReady("c1", tx as never)
    ).resolves.toBeUndefined();
  });
});
