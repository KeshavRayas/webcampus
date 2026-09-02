-- Phase 3 (M8): attempt-scoped uniqueness
-- Mark and Attendance uniqueness moves from (student, course[, batch]) to
-- application-enforced attempt scoping via nullable courseRegistrationId.
-- Backfill report was clean (0 unbackfilled rows).

-- Mark: drop legacy student+course unique (plain index in init migration)
DROP INDEX IF EXISTS "Mark_studentId_courseId_key";

-- CreateIndex
CREATE INDEX "Mark_studentId_courseId_idx" ON "Mark"("studentId", "courseId");

-- Attendance: unique was added as a table constraint in 20260806120000
ALTER TABLE "Attendance" DROP CONSTRAINT IF EXISTS "Attendance_studentId_courseId_batchId_electiveBatchId_key";

DROP INDEX IF EXISTS "Attendance_studentId_courseId_batchId_electiveBatchId_key";

-- CreateIndex
CREATE INDEX "Attendance_studentId_courseId_batchId_electiveBatchId_idx" ON "Attendance"("studentId", "courseId", "batchId", "electiveBatchId");
