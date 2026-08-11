-- Add semesterNumber to support explicit odd/even semester selection.
ALTER TABLE "public"."Semester"
ADD COLUMN "semesterNumber" INTEGER;

UPDATE "public"."Semester"
SET "semesterNumber" = CASE
  WHEN "type" = 'odd' THEN 1
  ELSE 2
END
WHERE "semesterNumber" IS NULL;

ALTER TABLE "public"."Semester"
ALTER COLUMN "semesterNumber" SET NOT NULL;

DROP INDEX IF EXISTS "public"."Semester_type_year_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Semester_type_year_semesterNumber_key"
ON "public"."Semester"("type", "year", "semesterNumber");
