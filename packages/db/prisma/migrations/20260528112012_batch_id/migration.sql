/*
  Warnings:

  - You are about to drop the column `academicYear` on the `CourseRegistration` table. All the data in the column will be lost.
  - You are about to drop the column `hasDropped` on the `CourseRegistration` table. All the data in the column will be lost.
  - You are about to drop the column `semester` on the `CourseRegistration` table. All the data in the column will be lost.
  - The primary key for the `_BatchStudents` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[studentId,courseId,batchId]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[studentId,courseId]` on the table `CourseRegistration` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_BatchStudents` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `academicTermId` to the `CourseRegistration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `semesterId` to the `CourseRegistration` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CourseAssignment" DROP CONSTRAINT "CourseAssignment_facultyId_departmentId_fkey";

-- DropIndex
DROP INDEX "Attendance_studentId_courseId_key";

-- DropIndex
DROP INDEX "CourseRegistration_studentId_courseId_semester_academicYear_key";

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "batchId" TEXT;

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "batchId" TEXT;

-- AlterTable
ALTER TABLE "CourseRegistration" DROP COLUMN "academicYear",
DROP COLUMN "hasDropped",
DROP COLUMN "semester",
ADD COLUMN     "academicTermId" TEXT NOT NULL,
ADD COLUMN     "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "semesterId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "_BatchStudents" DROP CONSTRAINT "_BatchStudents_AB_pkey";

-- CreateTable
CREATE TABLE "RegistrationWindow" (
    "id" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "departmentId" TEXT,
    "cycle" "Cycle",
    "isOpen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RegistrationWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseCoordinator" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,

    CONSTRAINT "CourseCoordinator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentTemplate" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "totalMarks" INTEGER NOT NULL,

    CONSTRAINT "AssessmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentQuestion" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "part" TEXT NOT NULL,
    "qNumber" TEXT NOT NULL,
    "marks" INTEGER NOT NULL,
    "co" TEXT,
    "po" TEXT,
    "bl" TEXT,
    "orGroupId" TEXT,

    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAssessment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',

    CONSTRAINT "StudentAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentQuestionMark" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "marksObtained" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StudentQuestionMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistrationWindow_academicTermId_semesterId_idx" ON "RegistrationWindow"("academicTermId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationWindow_academicTermId_semesterId_departmentId_c_key" ON "RegistrationWindow"("academicTermId", "semesterId", "departmentId", "cycle");

-- CreateIndex
CREATE INDEX "CourseCoordinator_courseId_idx" ON "CourseCoordinator"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCoordinator_courseId_facultyId_key" ON "CourseCoordinator"("courseId", "facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAssessment_studentId_assessmentId_key" ON "StudentAssessment"("studentId", "assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentQuestionMark_recordId_questionId_key" ON "StudentQuestionMark"("recordId", "questionId");

-- CreateIndex
CREATE INDEX "Attendance_batchId_idx" ON "Attendance"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_courseId_batchId_key" ON "Attendance"("studentId", "courseId", "batchId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_batchId_idx" ON "AttendanceRecord"("batchId");

-- CreateIndex
CREATE INDEX "CourseRegistration_semesterId_idx" ON "CourseRegistration"("semesterId");

-- CreateIndex
CREATE INDEX "CourseRegistration_academicTermId_idx" ON "CourseRegistration"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistration_studentId_courseId_key" ON "CourseRegistration"("studentId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "_BatchStudents_AB_unique" ON "_BatchStudents"("A", "B");

-- AddForeignKey
ALTER TABLE "RegistrationWindow" ADD CONSTRAINT "RegistrationWindow_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationWindow" ADD CONSTRAINT "RegistrationWindow_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationWindow" ADD CONSTRAINT "RegistrationWindow_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCoordinator" ADD CONSTRAINT "CourseCoordinator_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCoordinator" ADD CONSTRAINT "CourseCoordinator_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentTemplate" ADD CONSTRAINT "AssessmentTemplate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "AssessmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAssessment" ADD CONSTRAINT "StudentAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAssessment" ADD CONSTRAINT "StudentAssessment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "AssessmentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAssessment" ADD CONSTRAINT "StudentAssessment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestionMark" ADD CONSTRAINT "StudentQuestionMark_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "StudentAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestionMark" ADD CONSTRAINT "StudentQuestionMark_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ClassSession_courseId_sectionId_sessionDate_timingCode_batchId_" RENAME TO "ClassSession_courseId_sectionId_sessionDate_timingCode_batc_key";
