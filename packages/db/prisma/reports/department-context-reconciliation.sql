-- Department context reconciliation report
-- Purpose: identify legacy name-linked integrity risks while API transitions to departmentId.
-- Safe to run repeatedly; this script is read-only.

-- 1) High-risk: case-insensitive duplicate names can make resolver fallback ambiguous.
SELECT
  LOWER(name) AS normalized_name,
  COUNT(*) AS duplicate_count,
  ARRAY_AGG(id ORDER BY id) AS department_ids,
  ARRAY_AGG(name ORDER BY name) AS department_names
FROM "public"."Department"
GROUP BY LOWER(name)
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, normalized_name;

-- 2) Name quality issues that can confuse clients/logging.
SELECT id, name
FROM "public"."Department"
WHERE name <> BTRIM(name)
   OR name ~ '\\s{2,}'
ORDER BY name;

-- 3) Safety check for name-linked rows that do not resolve to Department.
-- These should normally be zero because of foreign keys.
SELECT 'Section' AS source_table, COUNT(*) AS unresolved_count
FROM "public"."Section" s
LEFT JOIN "public"."Department" d ON d.name = s."departmentName"
WHERE d.id IS NULL
UNION ALL
SELECT 'Course' AS source_table, COUNT(*) AS unresolved_count
FROM "public"."Course" c
LEFT JOIN "public"."Department" d ON d.name = c."departmentName"
WHERE d.id IS NULL
UNION ALL
SELECT 'Student' AS source_table, COUNT(*) AS unresolved_count
FROM "public"."Student" st
LEFT JOIN "public"."Department" d ON d.name = st."departmentName"
WHERE d.id IS NULL
UNION ALL
SELECT 'Hod' AS source_table, COUNT(*) AS unresolved_count
FROM "public"."Hod" h
LEFT JOIN "public"."Department" d ON d.name = h."departmentName"
WHERE h."departmentName" IS NOT NULL AND d.id IS NULL;

-- 4) Visibility: name-linked footprint by department.
SELECT
  d.id AS department_id,
  d.name AS department_name,
  COALESCE(sec.section_count, 0) AS section_rows,
  COALESCE(crs.course_count, 0) AS course_rows,
  COALESCE(stu.student_count, 0) AS student_rows,
  COALESCE(hod.hod_count, 0) AS hod_rows
FROM "public"."Department" d
LEFT JOIN (
  SELECT "departmentName", COUNT(*) AS section_count
  FROM "public"."Section"
  GROUP BY "departmentName"
) sec ON sec."departmentName" = d.name
LEFT JOIN (
  SELECT "departmentName", COUNT(*) AS course_count
  FROM "public"."Course"
  GROUP BY "departmentName"
) crs ON crs."departmentName" = d.name
LEFT JOIN (
  SELECT "departmentName", COUNT(*) AS student_count
  FROM "public"."Student"
  GROUP BY "departmentName"
) stu ON stu."departmentName" = d.name
LEFT JOIN (
  SELECT "departmentName", COUNT(*) AS hod_count
  FROM "public"."Hod"
  WHERE "departmentName" IS NOT NULL
  GROUP BY "departmentName"
) hod ON hod."departmentName" = d.name
ORDER BY d.name;
