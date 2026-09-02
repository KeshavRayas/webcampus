-- RR offering foundation: attempt-scoped CIE rows + re-registration sections.
--
-- 1. StudentAssessment: one row per (student, assessment, attempt). The old
--    global unique (studentId, assessmentId) enforced "Student + Course = one
--    assessment forever" and would make a second-attempt CIE upload overwrite
--    the original attempt. Replaced by two partial unique indexes (Prisma
--    cannot express partial indexes): pinned rows are unique per registration,
--    legacy null-pinned rows keep the old single-row semantics.
DROP INDEX IF EXISTS "StudentAssessment_studentId_assessmentId_key";
CREATE UNIQUE INDEX "StudentAssessment_attempt_key"
  ON "StudentAssessment"("studentId", "assessmentId", "courseRegistrationId")
  WHERE "courseRegistrationId" IS NOT NULL;
CREATE UNIQUE INDEX "StudentAssessment_legacy_key"
  ON "StudentAssessment"("studentId", "assessmentId")
  WHERE "courseRegistrationId" IS NULL;
CREATE INDEX "StudentAssessment_studentId_assessmentId_idx"
  ON "StudentAssessment"("studentId", "assessmentId");

-- 2. Section discriminator so admin-created re-registration offerings can be
--    excluded from regular-section sweeps (e.g. first-year promotion).
ALTER TABLE "Section" ADD COLUMN "registrationType" "RegistrationType" NOT NULL DEFAULT 'REGULAR';
CREATE INDEX "Section_registrationType_idx" ON "Section"("registrationType");
