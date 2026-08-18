-- DropForeignKey
ALTER TABLE "FeedbackResponse" DROP CONSTRAINT "FeedbackResponse_courseAssignmentId_fkey";

-- AlterTable
ALTER TABLE "FeedbackResponse" ADD COLUMN     "electiveBatchFacultyId" TEXT,
ALTER COLUMN "courseAssignmentId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "FeedbackResponse_feedbackRoundId_electiveBatchFacultyId_idx" ON "FeedbackResponse"("feedbackRoundId", "electiveBatchFacultyId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackResponse_studentId_feedbackRoundId_electiveBatchFac_key" ON "FeedbackResponse"("studentId", "feedbackRoundId", "electiveBatchFacultyId");

-- AddForeignKey
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_courseAssignmentId_fkey" FOREIGN KEY ("courseAssignmentId") REFERENCES "CourseAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_electiveBatchFacultyId_fkey" FOREIGN KEY ("electiveBatchFacultyId") REFERENCES "ElectiveBatchFaculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ownership XOR constraint
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_ownership_exactly_one" CHECK ((((("courseAssignmentId" IS NOT NULL))::integer + (("electiveBatchFacultyId" IS NOT NULL))::integer) = 1));
