-- Run only after backfill + verification gate (see .opencode/plans/cie-aggregation-refactor.md §5.3)

-- AlterTable
ALTER TABLE "AssessmentTemplate" ALTER COLUMN "componentType" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentTemplate_courseId_componentType_sequence_key" ON "AssessmentTemplate"("courseId", "componentType", "sequence");
