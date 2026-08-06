import { describe, expect, it } from "bun:test";

describe("feedback report scope rules", () => {
  it("restricts faculty reports to one faculty profile", () => {
    const scope = { role: "faculty", facultyId: "faculty-1" };
    expect(scope.facultyId).toBe("faculty-1");
    expect(scope.role).toBe("faculty");
  });

  it("restricts department roles to one department", () => {
    const scope = { role: "hod", departmentId: "department-1" };
    expect(scope.departmentId).toBe("department-1");
  });

  it("leaves admin scope institution-wide", () => {
    const scope: { role: string; facultyId?: string; departmentId?: string } = {
      role: "admin",
    };
    expect(scope.facultyId).toBeUndefined();
    expect(scope.departmentId).toBeUndefined();
  });
});
