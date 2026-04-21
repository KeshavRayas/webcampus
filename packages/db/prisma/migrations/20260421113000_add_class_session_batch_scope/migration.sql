ALTER TABLE "ClassSession"
ADD COLUMN "batchId" UUID;

CREATE INDEX "ClassSession_batchId_idx" ON "ClassSession"("batchId");

ALTER TABLE "ClassSession"
ADD CONSTRAINT "ClassSession_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "Batch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "ClassSession_courseId_sectionId_sessionDate_timingCode_key";

CREATE UNIQUE INDEX "ClassSession_courseId_sectionId_sessionDate_timingCode_batchId_key"
ON "ClassSession"("courseId", "sectionId", "sessionDate", "timingCode", "batchId");
