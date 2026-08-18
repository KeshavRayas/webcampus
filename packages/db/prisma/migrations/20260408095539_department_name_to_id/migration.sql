/*
  Warnings:

  - You are about to drop the column `branch` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `credits` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `hasLab` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `hodId` on the `Department` table. All the data in the column will be lost.
  - You are about to drop the column `isCurrent` on the `Semester` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Semester` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Semester` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `Semester` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[facultyId]` on the table `Hod` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[academicTermId,programType,semesterNumber]` on the table `Semester` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `categoryAllotted` to the `Admission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categoryClaimed` to the `Admission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quota` to the `Admission` table without a default value. This is not possible if the table is not empty.
  - Made the column `departmentId` on table `Admission` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `courseMode` to the `Course` table without a default value. This is not possible if the table is not empty.
  - Added the required column `courseType` to the `Course` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalCredits` to the `Course` table without a default value. This is not possible if the table is not empty.
  - Added the required column `academicTermId` to the `Semester` table without a default value. This is not possible if the table is not empty.
  - Added the required column `programType` to the `Semester` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('UG', 'PG');

-- CreateEnum
CREATE TYPE "CourseMode" AS ENUM ('INTEGRATED', 'NON_INTEGRATED', 'FINAL_SUMMARY', 'NCMC');

-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('PC', 'PE', 'OE', 'NCMC');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('GENERAL', 'OBC', 'SC', 'ST');

-- CreateEnum
CREATE TYPE "Quota" AS ENUM ('MERIT', 'MANAGEMENT', 'SPORTS', 'NRI', 'SNQ');

-- CreateEnum
CREATE TYPE "DepartmentType" AS ENUM ('DEGREE_GRANTING', 'BASIC_SCIENCES', 'SERVICE');

-- DropForeignKey
ALTER TABLE "Admission" DROP CONSTRAINT "Admission_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_hodId_fkey";

-- DropIndex
DROP INDEX "Department_hodId_key";

-- DropIndex
DROP INDEX "Hod_departmentName_key";

-- DropIndex
DROP INDEX "Semester_type_year_semesterNumber_key";

-- AlterTable
ALTER TABLE "Admission" DROP COLUMN "branch",
DROP COLUMN "categoryAllotted",
ADD COLUMN     "categoryAllotted" "Category" NOT NULL,
DROP COLUMN "categoryClaimed",
ADD COLUMN     "categoryClaimed" "Category" NOT NULL,
DROP COLUMN "quota",
ADD COLUMN     "quota" "Quota" NOT NULL,
ALTER COLUMN "departmentId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "credits",
DROP COLUMN "hasLab",
DROP COLUMN "type",
ADD COLUMN     "assignmentMaxMarks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cieMaxMarks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cieMinMarks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cieWeightage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "courseMode" "CourseMode" NOT NULL,
ADD COLUMN     "courseType" "CourseType" NOT NULL,
ADD COLUMN     "cumulativeMaxMarks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cumulativeMinMarks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hasLaboratoryComponent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "labMaxMarks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "labMinMarks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "labWeightage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lectureCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxNoOfCies" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minNoOfCies" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "noOfAssignments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "practicalCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seeMaxMarks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seeMinMarks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seeWeightage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "skillCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCredits" INTEGER NOT NULL,
ADD COLUMN     "tutorialCredits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Department" DROP COLUMN "hodId",
ADD COLUMN     "type" "DepartmentType" NOT NULL DEFAULT 'DEGREE_GRANTING';

-- AlterTable
ALTER TABLE "Hod" ADD COLUMN     "facultyId" TEXT;

-- AlterTable
ALTER TABLE "Semester" DROP COLUMN "isCurrent",
DROP COLUMN "name",
DROP COLUMN "type",
DROP COLUMN "year",
ADD COLUMN     "academicTermId" TEXT NOT NULL,
ADD COLUMN     "programType" "ProgramType" NOT NULL;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "academicTermId" TEXT,
ADD COLUMN     "academicTermLabel" TEXT,
ADD COLUMN     "academicTermType" "SemesterType",
ADD COLUMN     "academicTermYear" TEXT,
ADD COLUMN     "programType" "ProgramType",
ADD COLUMN     "semesterId" TEXT,
ADD COLUMN     "semesterNumber" INTEGER;

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" TEXT NOT NULL,
    "type" "SemesterType" NOT NULL,
    "year" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTerm_type_year_key" ON "AcademicTerm"("type", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Hod_facultyId_key" ON "Hod"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_academicTermId_programType_semesterNumber_key" ON "Semester"("academicTermId", "programType", "semesterNumber");

-- CreateIndex
CREATE INDEX "Student_semesterId_idx" ON "Student"("semesterId");

-- CreateIndex
CREATE INDEX "Student_semesterNumber_idx" ON "Student"("semesterNumber");

-- CreateIndex
CREATE INDEX "Student_programType_idx" ON "Student"("programType");

-- CreateIndex
CREATE INDEX "Student_academicTermId_idx" ON "Student"("academicTermId");

-- AddForeignKey
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hod" ADD CONSTRAINT "Hod_departmentName_fkey" FOREIGN KEY ("departmentName") REFERENCES "Department"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hod" ADD CONSTRAINT "Hod_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
