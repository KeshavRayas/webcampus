/*
  Warnings:

  - The primary key for the `Admission` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[applicationId]` on the table `Admission` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `applicationId` to the `Admission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `semesterId` to the `Admission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Admission` table without a default value. This is not possible if the table is not empty.
  - Made the column `modeOfAdmission` on table `Admission` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."AdmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "public"."Admission" DROP CONSTRAINT "Admission_pkey",
ADD COLUMN     "applicationId" TEXT NOT NULL,
ADD COLUMN     "casteCertificate" TEXT,
ADD COLUMN     "semesterId" TEXT NOT NULL,
ADD COLUMN     "status" "public"."AdmissionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "modeOfAdmission" SET NOT NULL,
ADD CONSTRAINT "Admission_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Admission_id_seq";

-- CreateIndex
CREATE UNIQUE INDEX "Admission_applicationId_key" ON "public"."Admission"("applicationId");

-- CreateIndex
CREATE INDEX "Admission_semesterId_idx" ON "public"."Admission"("semesterId");

-- AddForeignKey
ALTER TABLE "public"."Admission" ADD CONSTRAINT "Admission_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "public"."Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
