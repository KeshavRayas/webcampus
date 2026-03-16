/*
  Warnings:

  - You are about to drop the column `address` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `class10thMarks` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `class12thMarks` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `class12thSchoolName` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `Admission` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tempUsn]` on the table `Admission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[usn]` on the table `Admission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uniqueId]` on the table `Admission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[primaryEmail]` on the table `Admission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[aadharNumber]` on the table `Admission` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Admission_email_key";

-- AlterTable
ALTER TABLE "public"."Admission" DROP COLUMN "address",
DROP COLUMN "class10thMarks",
DROP COLUMN "class12thMarks",
DROP COLUMN "class12thSchoolName",
DROP COLUMN "email",
DROP COLUMN "name",
DROP COLUMN "phoneNumber",
ADD COLUMN     "aadharCard" TEXT,
ADD COLUMN     "aadharNumber" TEXT,
ADD COLUMN     "admissionDate" TIMESTAMP(3),
ADD COLUMN     "admissionType" TEXT,
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "branch" TEXT,
ADD COLUMN     "caste" TEXT,
ADD COLUMN     "categoryAllotted" TEXT,
ADD COLUMN     "categoryClaimed" TEXT,
ADD COLUMN     "class10thAggregateScore" DOUBLE PRECISION,
ADD COLUMN     "class10thAggregateTotal" DOUBLE PRECISION,
ADD COLUMN     "class10thMediumOfTeaching" TEXT,
ADD COLUMN     "class10thSchoolCity" TEXT,
ADD COLUMN     "class10thSchoolCode" TEXT,
ADD COLUMN     "class10thSchoolState" TEXT,
ADD COLUMN     "class10thSchoolType" TEXT,
ADD COLUMN     "class10thYearOfPassing" TEXT,
ADD COLUMN     "class12thAggregateScore" DOUBLE PRECISION,
ADD COLUMN     "class12thAggregateTotal" DOUBLE PRECISION,
ADD COLUMN     "class12thBranch" TEXT,
ADD COLUMN     "class12thInstituteCity" TEXT,
ADD COLUMN     "class12thInstituteCode" TEXT,
ADD COLUMN     "class12thInstituteName" TEXT,
ADD COLUMN     "class12thInstituteState" TEXT,
ADD COLUMN     "class12thInstituteType" TEXT,
ADD COLUMN     "class12thMediumOfTeaching" TEXT,
ADD COLUMN     "class12thYearOfPassing" TEXT,
ADD COLUMN     "currentAddress" TEXT,
ADD COLUMN     "currentArea" TEXT,
ADD COLUMN     "currentCity" TEXT,
ADD COLUMN     "currentCountry" TEXT,
ADD COLUMN     "currentDistrict" TEXT,
ADD COLUMN     "currentPincode" TEXT,
ADD COLUMN     "currentState" TEXT,
ADD COLUMN     "disability" BOOLEAN,
ADD COLUMN     "disabilityCertificate" TEXT,
ADD COLUMN     "disabilityType" TEXT,
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "economicallyBackward" BOOLEAN,
ADD COLUMN     "economicallyBackwardCertificate" TEXT,
ADD COLUMN     "emergencyContactNumber" TEXT,
ADD COLUMN     "entranceExamRank" TEXT,
ADD COLUMN     "fatherOccupation" TEXT,
ADD COLUMN     "fatherPermanentAddress" TEXT,
ADD COLUMN     "feePaid" DOUBLE PRECISION,
ADD COLUMN     "feePayable" DOUBLE PRECISION,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "guardianEmail" TEXT,
ADD COLUMN     "guardianName" TEXT,
ADD COLUMN     "guardianNumber" TEXT,
ADD COLUMN     "guardianOccupation" TEXT,
ADD COLUMN     "guardianPermanentAddress" TEXT,
ADD COLUMN     "hostel" BOOLEAN,
ADD COLUMN     "hostelRoomNumber" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "motherOccupation" TEXT,
ADD COLUMN     "motherPermanentAddress" TEXT,
ADD COLUMN     "motherTongue" TEXT,
ADD COLUMN     "nameAsPer10th" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "nri" BOOLEAN,
ADD COLUMN     "originalAdmissionOrderDate" TIMESTAMP(3),
ADD COLUMN     "originalAdmissionOrderNumber" TEXT,
ADD COLUMN     "permanentAddress" TEXT,
ADD COLUMN     "permanentArea" TEXT,
ADD COLUMN     "permanentCity" TEXT,
ADD COLUMN     "permanentCountry" TEXT,
ADD COLUMN     "permanentDistrict" TEXT,
ADD COLUMN     "permanentPincode" TEXT,
ADD COLUMN     "permanentState" TEXT,
ADD COLUMN     "placeOfBirth" TEXT,
ADD COLUMN     "primaryEmail" TEXT,
ADD COLUMN     "primaryPhoneNumber" TEXT,
ADD COLUMN     "quota" TEXT,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "secondaryEmail" TEXT,
ADD COLUMN     "secondaryPhoneNumber" TEXT,
ADD COLUMN     "stateOfBirth" TEXT,
ADD COLUMN     "studyCertificate" TEXT,
ADD COLUMN     "subCaste" TEXT,
ADD COLUMN     "tempUsn" TEXT,
ADD COLUMN     "transferCertificate" TEXT,
ADD COLUMN     "uniqueId" TEXT,
ADD COLUMN     "usn" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Admission_tempUsn_key" ON "public"."Admission"("tempUsn");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_usn_key" ON "public"."Admission"("usn");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_uniqueId_key" ON "public"."Admission"("uniqueId");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_primaryEmail_key" ON "public"."Admission"("primaryEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_aadharNumber_key" ON "public"."Admission"("aadharNumber");
