-- CreateEnum
CREATE TYPE "public"."StaffType" AS ENUM ('TEMPORARY', 'REGULAR', 'POP', 'ADJUNCT');

-- CreateEnum
CREATE TYPE "public"."FacultyGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."QualificationProgramType" AS ENUM ('FULL_TIME', 'PART_TIME');

-- CreateEnum
CREATE TYPE "public"."PublicationCategory" AS ENUM ('JOURNAL', 'CONFERENCE', 'BOOK_CHAPTER_OR_BOOK', 'CASE_STUDY', 'PATENT');

-- AlterTable
ALTER TABLE "public"."Faculty"
ADD COLUMN     "aboutYourself" TEXT,
ADD COLUMN     "alternateContactNumber" TEXT,
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "contactInformation" TEXT,
ADD COLUMN     "dateOfJoining" TIMESTAMP(3),
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "gender" "public"."FacultyGender",
ADD COLUMN     "maritalStatus" "public"."MaritalStatus",
ADD COLUMN     "mobileNumber" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "officeRoom" TEXT,
ADD COLUMN     "officialEmail" TEXT,
ADD COLUMN     "otherInformation" TEXT,
ADD COLUMN     "permanentAddressLine" TEXT,
ADD COLUMN     "permanentCity" TEXT,
ADD COLUMN     "permanentPincode" TEXT,
ADD COLUMN     "permanentState" TEXT,
ADD COLUMN     "personalEmail" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "presentAddressLine" TEXT,
ADD COLUMN     "presentCity" TEXT,
ADD COLUMN     "presentPincode" TEXT,
ADD COLUMN     "presentState" TEXT,
ADD COLUMN     "profileUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "qualification" TEXT,
ADD COLUMN     "researchArea" TEXT,
ADD COLUMN     "researchInterests" TEXT,
ADD COLUMN     "sameAsPresentAddress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "staffType" "public"."StaffType";

-- CreateTable
CREATE TABLE "public"."FacultyQualification" (
    "id" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "programType" "public"."QualificationProgramType" NOT NULL,
    "yearPassed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacultyQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FacultyPublication" (
    "id" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "category" "public"."PublicationCategory" NOT NULL,
    "publishedDate" TIMESTAMP(3) NOT NULL,
    "authors" TEXT NOT NULL,
    "publicationDetails" TEXT NOT NULL,
    "weblink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacultyPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FacultyExperience" (
    "id" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacultyExperience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_employeeId_key" ON "public"."Faculty"("employeeId");

-- CreateIndex
CREATE INDEX "FacultyQualification_facultyId_idx" ON "public"."FacultyQualification"("facultyId");

-- CreateIndex
CREATE INDEX "FacultyPublication_facultyId_idx" ON "public"."FacultyPublication"("facultyId");

-- CreateIndex
CREATE INDEX "FacultyExperience_facultyId_idx" ON "public"."FacultyExperience"("facultyId");

-- AddForeignKey
ALTER TABLE "public"."FacultyQualification" ADD CONSTRAINT "FacultyQualification_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "public"."Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FacultyPublication" ADD CONSTRAINT "FacultyPublication_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "public"."Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FacultyExperience" ADD CONSTRAINT "FacultyExperience_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "public"."Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
