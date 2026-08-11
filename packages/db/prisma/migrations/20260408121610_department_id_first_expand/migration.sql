/*
  Warnings:

  - A unique constraint covering the columns `[id,departmentId]` on the table `Course` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[departmentId,courseId,facultyId,sectionId,batchId,assignmentType,semester,academicYear]` on the table `CourseAssignment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,departmentId]` on the table `Faculty` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,departmentId]` on the table `Section` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,departmentId,semesterId]` on the table `Section` will be added. If there are existing duplicate values, this will fail.
  - Added the nullable column `departmentId` to the `Course` table. It will be backfilled and made NOT NULL in the contract stage.
  - Added the nullable column `departmentId` to the `CourseAssignment` table. It will be backfilled and made NOT NULL in the contract stage.
  - Added the nullable column `departmentId` to the `Section` table. It will be backfilled and made NOT NULL in the contract stage.

*/
-- CreateEnum
CREATE TYPE "DepartmentScopedRole" AS ENUM ('ADMIN', 'HOD', 'FACULTY', 'STAFF', 'VIEWER');

-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_departmentName_fkey";

-- DropForeignKey
ALTER TABLE "CourseAssignment" DROP CONSTRAINT "CourseAssignment_courseId_fkey";

-- DropForeignKey
ALTER TABLE "CourseAssignment" DROP CONSTRAINT "CourseAssignment_facultyId_fkey";

-- DropForeignKey
ALTER TABLE "CourseAssignment" DROP CONSTRAINT "CourseAssignment_sectionId_fkey";

-- DropForeignKey
ALTER TABLE "Section" DROP CONSTRAINT "Section_departmentName_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Course_departmentName_semesterId_cycle_approvalStatus_idx";

-- DropIndex
DROP INDEX IF EXISTS "Course_departmentName_semesterId_idx";

-- DropIndex
DROP INDEX IF EXISTS "CourseAssignment_courseId_facultyId_sectionId_batchId_assig_key";

-- DropIndex
DROP INDEX IF EXISTS "Section_departmentName_semesterId_cycle_idx";

-- DropIndex
DROP INDEX IF EXISTS "Section_departmentName_semesterId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Section_name_departmentName_semesterId_key";

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "departmentId" TEXT,
ALTER COLUMN "departmentName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CourseAssignment" ADD COLUMN     "departmentId" TEXT;

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "departmentId" TEXT,
ALTER COLUMN "departmentName" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DepartmentUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "role" "DepartmentScopedRole" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DepartmentUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepartmentUser_departmentId_role_idx" ON "DepartmentUser"("departmentId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentUser_userId_departmentId_role_key" ON "DepartmentUser"("userId", "departmentId", "role");

-- CreateIndex
CREATE INDEX "Course_departmentId_semesterId_idx" ON "Course"("departmentId", "semesterId");

-- CreateIndex
CREATE INDEX "Course_departmentId_semesterId_cycle_approvalStatus_idx" ON "Course"("departmentId", "semesterId", "cycle", "approvalStatus");

-- CreateIndex
CREATE INDEX "Course_departmentId_semesterId_semesterNumber_idx" ON "Course"("departmentId", "semesterId", "semesterNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Course_id_departmentId_key" ON "Course"("id", "departmentId");

-- CreateIndex
CREATE INDEX "CourseAssignment_departmentId_sectionId_semester_idx" ON "CourseAssignment"("departmentId", "sectionId", "semester");

-- CreateIndex
CREATE INDEX "CourseAssignment_departmentId_courseId_semester_idx" ON "CourseAssignment"("departmentId", "courseId", "semester");

-- CreateIndex
CREATE INDEX "CourseAssignment_facultyId_semester_academicYear_idx" ON "CourseAssignment"("facultyId", "semester", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAssignment_departmentId_courseId_facultyId_sectionId__key" ON "CourseAssignment"("departmentId", "courseId", "facultyId", "sectionId", "batchId", "assignmentType", "semester", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_id_departmentId_key" ON "Faculty"("id", "departmentId");

-- CreateIndex
CREATE INDEX "Section_departmentId_semesterId_idx" ON "Section"("departmentId", "semesterId");

-- CreateIndex
CREATE INDEX "Section_departmentId_semesterId_cycle_idx" ON "Section"("departmentId", "semesterId", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "Section_id_departmentId_key" ON "Section"("id", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_name_departmentId_semesterId_key" ON "Section"("name", "departmentId", "semesterId");

-- AddForeignKey
ALTER TABLE "DepartmentUser" ADD CONSTRAINT "DepartmentUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentUser" ADD CONSTRAINT "DepartmentUser_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_courseId_departmentId_fkey" FOREIGN KEY ("courseId", "departmentId") REFERENCES "Course"("id", "departmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_facultyId_departmentId_fkey" FOREIGN KEY ("facultyId", "departmentId") REFERENCES "Faculty"("id", "departmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_sectionId_departmentId_fkey" FOREIGN KEY ("sectionId", "departmentId") REFERENCES "Section"("id", "departmentId") ON DELETE RESTRICT ON UPDATE CASCADE;
