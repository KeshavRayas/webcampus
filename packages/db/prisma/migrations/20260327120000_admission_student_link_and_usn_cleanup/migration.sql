-- Link Admission rows to Student rows before removing legacy Admission.usn.
ALTER TABLE "public"."Admission"
ADD COLUMN "studentId" TEXT;

UPDATE "public"."Admission" AS a
SET "studentId" = s."id"
FROM "public"."Student" AS s
WHERE a."usn" IS NOT NULL
  AND s."usn" = a."usn"
  AND a."studentId" IS NULL;

ALTER TABLE "public"."Admission"
ADD CONSTRAINT "Admission_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Admission_studentId_key"
ON "public"."Admission"("studentId");

ALTER TABLE "public"."Admission"
DROP COLUMN "admissionDate",
DROP COLUMN "admissionType",
DROP COLUMN "usn";
