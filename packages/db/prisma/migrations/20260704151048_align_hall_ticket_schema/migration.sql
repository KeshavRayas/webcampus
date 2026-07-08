-- DropIndex
DROP INDEX "HallTicket_studentId_academicTermId_key";

-- AlterTable
ALTER TABLE "HallTicket" DROP COLUMN "generatedAt",
DROP COLUMN "isPublished",
DROP COLUMN "publishedAt",
DROP COLUMN "status",
ADD COLUMN     "isSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "semesterId" TEXT NOT NULL,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "sentBy" TEXT;

-- DropEnum
DROP TYPE "HallTicketStatus";

-- CreateIndex
CREATE INDEX "HallTicket_semesterId_idx" ON "HallTicket"("semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "HallTicket_studentId_academicTermId_semesterId_key" ON "HallTicket"("studentId", "academicTermId", "semesterId");

-- AddForeignKey
ALTER TABLE "HallTicket" ADD CONSTRAINT "HallTicket_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
