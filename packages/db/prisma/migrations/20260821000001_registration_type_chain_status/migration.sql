-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('REGULAR', 'RE_REGISTRATION', 'SUPPLEMENTARY');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'SUPERSEDED');

-- DropIndex
DROP INDEX "CourseRegistration_studentId_courseId_key";

-- AlterTable
ALTER TABLE "CourseRegistration" ADD COLUMN     "registrationType" "RegistrationType" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "sourceRegistrationId" TEXT,
ADD COLUMN     "status" "RegistrationStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "CourseRegistration_sourceRegistrationId_idx" ON "CourseRegistration"("sourceRegistrationId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistration_studentId_courseId_academicTermId_regist_key" ON "CourseRegistration"("studentId", "courseId", "academicTermId", "registrationType");

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_sourceRegistrationId_fkey" FOREIGN KEY ("sourceRegistrationId") REFERENCES "CourseRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
