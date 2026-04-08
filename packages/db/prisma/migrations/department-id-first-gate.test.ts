/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
const gateMigrationUrl = new URL(
  "./20260408122101_department_id_first_gate/migration.sql",
  import.meta.url
);

describe("department_id_first_gate migration", () => {
  it("contains gate checks for unmapped rows and cross-department mismatches", async () => {
    const sql = await Bun.file(gateMigrationUrl).text();

    expect(sql).toContain('FROM "Course"');
    expect(sql).toContain('FROM "Section"');
    expect(sql).toContain('FROM "CourseAssignment"');

    expect(sql).toContain('WHERE "departmentId" IS NULL');
    expect(sql).toContain('JOIN "Course" c ON c.id = ca."courseId"');
    expect(sql).toContain('JOIN "Section" s ON s.id = ca."sectionId"');
    expect(sql).toContain('ca."departmentId" IS DISTINCT FROM c."departmentId"');
    expect(sql).toContain('ca."departmentId" IS DISTINCT FROM s."departmentId"');

    expect(sql).toContain("RAISE EXCEPTION");
    expect(sql).toContain("DepartmentId gate failed");
  });
});
