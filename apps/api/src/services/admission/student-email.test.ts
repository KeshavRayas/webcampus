/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import { buildStudentEmailAddress } from "./student-email";

describe("buildStudentEmailAddress", () => {
  it("builds the base student email from the first name", () => {
    const email = buildStudentEmailAddress({
      firstName: "Keshav",
      lastName: "G",
      departmentCode: "CS",
      academicYear: "2022",
      firstNameCount: 1,
      firstNameLastInitialCount: 1,
    });

    expect(email).toBe("keshav.cs22@bmsce.ac.in");
  });

  it("uses the last name initial when first names collide in the same department and year", () => {
    const occupied = new Set<string>();

    const first = buildStudentEmailAddress({
      firstName: "Keshav",
      lastName: "G",
      departmentCode: "CS",
      academicYear: "2022",
      firstNameCount: 2,
      firstNameLastInitialCount: 1,
      occupiedLocalParts: occupied,
    });
    occupied.add(first.split("@")[0]);

    const second = buildStudentEmailAddress({
      firstName: "Keshav",
      lastName: "R",
      departmentCode: "CS",
      academicYear: "2022",
      firstNameCount: 2,
      firstNameLastInitialCount: 1,
      occupiedLocalParts: occupied,
    });

    expect(first).toBe("keshavg.cs22@bmsce.ac.in");
    expect(second).toBe("keshavr.cs22@bmsce.ac.in");
  });

  it("adds a numeric suffix when the first name plus last initial still collides", () => {
    const occupied = new Set<string>(["keshavg.cs22"]);

    const first = buildStudentEmailAddress({
      firstName: "Keshav",
      lastName: "G",
      departmentCode: "CS",
      academicYear: "2022",
      firstNameCount: 2,
      firstNameLastInitialCount: 2,
      occupiedLocalParts: occupied,
    });
    occupied.add(first.split("@")[0]);

    const second = buildStudentEmailAddress({
      firstName: "Keshav",
      lastName: "G",
      departmentCode: "CS",
      academicYear: "2022",
      firstNameCount: 2,
      firstNameLastInitialCount: 2,
      occupiedLocalParts: occupied,
    });

    expect(first).toBe("keshavg1.cs22@bmsce.ac.in");
    expect(second).toBe("keshavg2.cs22@bmsce.ac.in");
  });
});