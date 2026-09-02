-- Phase 3 (M7): attempt-aware attendance / marks / assessments
-- Adds nullable courseRegistrationId pins + indexes + FKs, and the
-- StudentPromotion idempotency unique (review finding #1).

ALTER TABLE "Attendance" ADD COLUMN "courseRegistrationId" TEXT;

ALTER TABLE "Mark" ADD COLUMN "courseRegistrationId" TEXT;

ALTER TABLE "StudentAssessment" ADD COLUMN "courseRegistrationId" TEXT;

-- CreateIndex
CREATE INDEX "Attendance_courseRegistrationId_idx" ON "Attendance"("courseRegistrationId");

-- CreateIndex
CREATE INDEX "Mark_courseRegistrationId_idx" ON "Mark"("courseRegistrationId");

-- CreateIndex
CREATE INDEX "StudentAssessment_courseRegistrationId_idx" ON "StudentAssessment"("courseRegistrationId");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_courseRegistrationId_fkey" FOREIGN KEY ("courseRegistrationId") REFERENCES "CourseRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_courseRegistrationId_fkey" FOREIGN KEY ("courseRegistrationId") REFERENCES "CourseRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAssessment" ADD CONSTRAINT "StudentAssessment_courseRegistrationId_fkey" FOREIGN KEY ("courseRegistrationId") REFERENCES "CourseRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- StudentPromotion: one promotion per student per term per from-semester
-- DropIndex
DROP INDEX "StudentPromotion_studentId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "StudentPromotion_studentId_academicTermId_fromSemesterNumbe_key" ON "StudentPromotion"("studentId", "academicTermId", "fromSemesterNumber");
