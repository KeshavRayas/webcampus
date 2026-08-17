-- AlterEnum
ALTER TYPE "AdmissionStatus" ADD VALUE 'PORTED';

-- AlterTable
ALTER TABLE "Admission" DROP COLUMN "posted";
