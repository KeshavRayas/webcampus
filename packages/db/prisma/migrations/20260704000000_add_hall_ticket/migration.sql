-- CreateEnum
CREATE TYPE "HallTicketStatus" AS ENUM ('ACTIVE', 'STALE');

-- CreateTable
CREATE TABLE "HallTicket" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "status" "HallTicketStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HallTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HallTicket_studentId_idx" ON "HallTicket"("studentId");

-- CreateIndex
CREATE INDEX "HallTicket_academicTermId_idx" ON "HallTicket"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "HallTicket_studentId_academicTermId_key" ON "HallTicket"("studentId", "academicTermId");

-- AddForeignKey
ALTER TABLE "HallTicket" ADD CONSTRAINT "HallTicket_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallTicket" ADD CONSTRAINT "HallTicket_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
