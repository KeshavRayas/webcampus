-- M61: Add ProgrammeOutcome, CourseOutcome and AssessmentQuestion peo/pso mappings
-- These models were added to schema.prisma in 98bf6af / c406e6f but no migration was generated.
-- This migration is idempotent (IF NOT EXISTS / DO blocks) so it succeeds both on fresh DBs
-- (via `prisma migrate deploy`) and on existing DBs that were created via `prisma db push`
-- where the tables already exist.

-- CreateEnum: OutcomeType
DO $$ BEGIN
  CREATE TYPE "OutcomeType" AS ENUM ('PEO', 'PSO', 'PO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: AssessmentQuestion - add peo/pso for QP setup mapping
ALTER TABLE "AssessmentQuestion" ADD COLUMN IF NOT EXISTS "peo" TEXT;
ALTER TABLE "AssessmentQuestion" ADD COLUMN IF NOT EXISTS "pso" TEXT;

-- CreateTable: ProgrammeOutcome
CREATE TABLE IF NOT EXISTS "ProgrammeOutcome" (
    "id" TEXT NOT NULL,
    "programType" "ProgramType" NOT NULL,
    "departmentId" TEXT,
    "type" "OutcomeType" NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgrammeOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CourseOutcome
CREATE TABLE IF NOT EXISTS "CourseOutcome" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: ProgrammeOutcome unique [programType, departmentId, type, code]
CREATE UNIQUE INDEX IF NOT EXISTS "ProgrammeOutcome_programType_departmentId_type_code_key" ON "ProgrammeOutcome"("programType", "departmentId", "type", "code");

-- CreateIndex: CourseOutcome unique [courseId, code]
CREATE UNIQUE INDEX IF NOT EXISTS "CourseOutcome_courseId_code_key" ON "CourseOutcome"("courseId", "code");

-- AddForeignKey: ProgrammeOutcome -> Department (SET NULL)
DO $$ BEGIN
  ALTER TABLE "ProgrammeOutcome" ADD CONSTRAINT "ProgrammeOutcome_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: CourseOutcome -> Course (CASCADE)
DO $$ BEGIN
  ALTER TABLE "CourseOutcome" ADD CONSTRAINT "CourseOutcome_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
