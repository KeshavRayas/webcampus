/*
  Warnings:

  - You are about to drop the column `class12thInstituteCode` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `diplomaInstituteCode` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `feePayable` on the `Admission` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Admission" DROP COLUMN "class12thInstituteCode",
DROP COLUMN "diplomaInstituteCode",
DROP COLUMN "feePayable";
