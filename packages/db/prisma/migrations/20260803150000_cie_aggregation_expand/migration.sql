-- CreateEnum
CREATE TYPE "AssessmentComponentType" AS ENUM ('THEORY', 'LAB', 'AAT');

-- CreateEnum
CREATE TYPE "CieEligibilityPolicy" AS ENUM ('OVERALL_ONLY', 'COMPONENT_AND_OVERALL');

-- AlterTable
ALTER TABLE "Course"
ADD COLUMN "cieEligibilityPolicy" "CieEligibilityPolicy" NOT NULL DEFAULT 'COMPONENT_AND_OVERALL';

-- AlterTable
ALTER TABLE "AssessmentTemplate"
ADD COLUMN "componentType" "AssessmentComponentType",
ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 1;
