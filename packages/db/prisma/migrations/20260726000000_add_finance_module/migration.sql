-- Finance records are isolated from admissions and linked to a student record.
CREATE TABLE "Finance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "finalFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancePayment" (
    "id" TEXT NOT NULL,
    "financeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancePayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Finance_studentId_academicYear_key" ON "Finance"("studentId", "academicYear");
CREATE INDEX "Finance_studentId_idx" ON "Finance"("studentId");
CREATE INDEX "Finance_academicYear_idx" ON "Finance"("academicYear");
CREATE INDEX "FinancePayment_financeId_idx" ON "FinancePayment"("financeId");
CREATE INDEX "FinancePayment_paidAt_idx" ON "FinancePayment"("paidAt");

ALTER TABLE "Finance" ADD CONSTRAINT "Finance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_financeId_fkey" FOREIGN KEY ("financeId") REFERENCES "Finance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
