-- CreateEnum
CREATE TYPE "ProjectGroupingScope" AS ENUM ('WITHIN_SECTION', 'DEPARTMENT_WIDE');

-- AlterEnum
ALTER TYPE "CourseType" ADD VALUE 'CC';
ALTER TYPE "CourseType" ADD VALUE 'MJE';
ALTER TYPE "CourseType" ADD VALUE 'MNE';
ALTER TYPE "CourseType" ADD VALUE 'P';
ALTER TYPE "CourseType" ADD VALUE 'PW';
ALTER TYPE "CourseType" ADD VALUE 'SR';
ALTER TYPE "CourseType" ADD VALUE 'NT';
ALTER TYPE "CourseType" ADD VALUE 'BS';
ALTER TYPE "CourseType" ADD VALUE 'ES';
ALTER TYPE "CourseType" ADD VALUE 'AE';
ALTER TYPE "CourseType" ADD VALUE 'HS';
ALTER TYPE "CourseType" ADD VALUE 'MG';
ALTER TYPE "CourseType" ADD VALUE 'GC';
ALTER TYPE "CourseType" ADD VALUE 'AM';
ALTER TYPE "CourseType" ADD VALUE 'ASC1';
ALTER TYPE "CourseType" ADD VALUE 'ASC2';
ALTER TYPE "CourseType" ADD VALUE 'ESC1';
ALTER TYPE "CourseType" ADD VALUE 'PLC';
ALTER TYPE "CourseType" ADD VALUE 'SDC';
ALTER TYPE "CourseType" ADD VALUE 'ETC';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "projectGroupingScope" "ProjectGroupingScope" NOT NULL DEFAULT 'WITHIN_SECTION';

-- AlterTable
ALTER TABLE "ElectiveBatch" ADD COLUMN     "sectionId" TEXT;

-- CreateIndex
CREATE INDEX "ElectiveBatch_sectionId_idx" ON "ElectiveBatch"("sectionId");

-- AddForeignKey
ALTER TABLE "ElectiveBatch" ADD CONSTRAINT "ElectiveBatch_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
