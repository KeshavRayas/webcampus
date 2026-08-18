/*
  Warnings:

  - You are about to drop the column `departmentName` on the `Faculty` table. All the data in the column will be lost.
  - Added the required column `departmentId` to the `Faculty` table without a default value. This is not possible if the table is not empty.
  - Added the required column `designation` to the `Faculty` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shortName` to the `Faculty` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."Designation" AS ENUM ('ASSOCIATE_PROFESSOR', 'ASSISTANT_PROFESSOR', 'PROFESSOR', 'VISITING_PROFESSOR');

-- DropForeignKey
ALTER TABLE "public"."Faculty" DROP CONSTRAINT "Faculty_departmentName_fkey";

-- DropIndex
DROP INDEX "public"."Faculty_departmentName_idx";

-- AlterTable
ALTER TABLE "public"."Faculty" DROP COLUMN "departmentName",
ADD COLUMN     "departmentId" TEXT NOT NULL,
ADD COLUMN     "designation" "public"."Designation" NOT NULL,
ADD COLUMN     "shortName" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Faculty_departmentId_idx" ON "public"."Faculty"("departmentId");

-- AddForeignKey
ALTER TABLE "public"."Faculty" ADD CONSTRAINT "Faculty_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
