/*
  Warnings:

  - You are about to drop the `AdmissionArchive` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AdmissionArchive" DROP CONSTRAINT "AdmissionArchive_admissionId_fkey";

-- DropForeignKey
ALTER TABLE "AdmissionArchive" DROP CONSTRAINT "AdmissionArchive_cancelledById_fkey";

-- DropTable
DROP TABLE "AdmissionArchive";

-- CreateTable
CREATE TABLE "CancelledAdmissions" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "cancelledById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancelledAdmissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CancelledAdmissions_admissionId_key" ON "CancelledAdmissions"("admissionId");

-- CreateIndex
CREATE INDEX "CancelledAdmissions_cancelledById_idx" ON "CancelledAdmissions"("cancelledById");

-- CreateIndex
CREATE INDEX "CancelledAdmissions_cancelledAt_idx" ON "CancelledAdmissions"("cancelledAt");

-- AddForeignKey
ALTER TABLE "CancelledAdmissions" ADD CONSTRAINT "CancelledAdmissions_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancelledAdmissions" ADD CONSTRAINT "CancelledAdmissions_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
