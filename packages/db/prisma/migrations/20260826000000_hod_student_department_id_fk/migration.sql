-- M52: Replace name-based foreign keys on Hod and Student with ID-based FKs
-- Follows the same pattern used for Course/Section in earlier migrations.

-- ──────────────────────────────────────────────────────────────
-- 1. Add departmentId columns
-- ──────────────────────────────────────────────────────────────
ALTER TABLE "Hod" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "Student" ADD COLUMN "departmentId" TEXT;

-- ──────────────────────────────────────────────────────────────
-- 2. Backfill departmentId from departmentName via Department table
-- ──────────────────────────────────────────────────────────────
UPDATE "Hod" h
SET "departmentId" = d."id"
FROM "Department" d
WHERE h."departmentName" = d."name"
  AND h."departmentId" IS NULL;

UPDATE "Student" s
SET "departmentId" = d."id"
FROM "Department" d
WHERE s."departmentName" = d."name"
  AND s."departmentId" IS NULL;

-- ──────────────────────────────────────────────────────────────
-- 3. Drop the old name-based FK constraints
-- ──────────────────────────────────────────────────────────────
ALTER TABLE "Hod" DROP CONSTRAINT IF EXISTS "Hod_departmentName_fkey";
ALTER TABLE "Student" DROP CONSTRAINT IF EXISTS "Student_departmentName_fkey";

-- ──────────────────────────────────────────────────────────────
-- 4. Add NOT NULL + FK constraints on departmentId
-- ──────────────────────────────────────────────────────────────
-- Hod.departmentId stays nullable because some HODs may not have
-- a department assigned yet.
ALTER TABLE "Hod" ADD CONSTRAINT "Hod_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL;

ALTER TABLE "Student" ALTER COLUMN "departmentId" SET NOT NULL;
ALTER TABLE "Student" ADD CONSTRAINT "Student_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE;

-- ──────────────────────────────────────────────────────────────
-- 5. Add indexes (replacing old departmentName-based indexes)
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Hod_departmentId_idx" ON "Hod"("departmentId");
-- Student indexes are already updated via departmentId in the schema

-- ──────────────────────────────────────────────────────────────
-- 6. Add NOT NULL constraint on Hod.departmentId
--    (Hod is nullable in old schema; enforce NOT NULL after backfill)
-- ──────────────────────────────────────────────────────────────
-- Note: Hod.departmentId stays nullable because some HODs may not have
-- a department assigned yet. The FK constraint still enforces referential
-- integrity when the value is present.
