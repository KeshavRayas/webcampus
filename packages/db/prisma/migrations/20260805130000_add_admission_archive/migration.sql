-- CreateEnum
CREATE TYPE "AdmissionStatus_new" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXITED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Admission" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Admission" ALTER COLUMN "status" TYPE "AdmissionStatus_new" USING ("status"::text::"AdmissionStatus_new");
ALTER TABLE "Admission" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- DropEnum
DROP TYPE "AdmissionStatus";

-- RenameEnum
ALTER TYPE "AdmissionStatus_new" RENAME TO "AdmissionStatus";

-- CreateTable
CREATE TABLE "AdmissionArchive" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "cancelledById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionArchive_admissionId_key" ON "AdmissionArchive"("admissionId");
CREATE INDEX "AdmissionArchive_cancelledById_idx" ON "AdmissionArchive"("cancelledById");
CREATE INDEX "AdmissionArchive_cancelledAt_idx" ON "AdmissionArchive"("cancelledAt");

-- AddForeignKey
ALTER TABLE "AdmissionArchive" ADD CONSTRAINT "AdmissionArchive_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdmissionArchive" ADD CONSTRAINT "AdmissionArchive_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
