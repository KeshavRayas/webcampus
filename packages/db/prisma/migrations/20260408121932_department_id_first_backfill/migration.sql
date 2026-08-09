-- Backfill department ownership from legacy departmentName values.
-- This phase is intentionally non-destructive: rows that cannot be mapped
-- cleanly are left for the gate migration to reject before finalization.

UPDATE "Course" c
SET
	"departmentId" = d.id,
	"departmentName" = COALESCE(c."departmentName", d.name)
FROM "Department" d
WHERE c."departmentId" IS NULL
	AND c."departmentName" = d.name;

UPDATE "Section" s
SET
	"departmentId" = d.id,
	"departmentName" = COALESCE(s."departmentName", d.name)
FROM "Department" d
WHERE s."departmentId" IS NULL
	AND s."departmentName" = d.name;

UPDATE "Course" c
SET "departmentName" = d.name
FROM "Department" d
WHERE c."departmentId" = d.id
	AND c."departmentName" IS DISTINCT FROM d.name;

UPDATE "Section" s
SET "departmentName" = d.name
FROM "Department" d
WHERE s."departmentId" = d.id
	AND s."departmentName" IS DISTINCT FROM d.name;

UPDATE "CourseAssignment" ca
SET "departmentId" = s."departmentId"
FROM "Section" s
WHERE ca."sectionId" = s.id
	AND s."departmentId" IS NOT NULL
	AND ca."departmentId" IS DISTINCT FROM s."departmentId";