-- Drop the unique constraint on Admission.primaryEmail so cancelled applicant
-- emails can be reused by a new applicant.
DROP INDEX IF EXISTS "Admission_primaryEmail_key";

-- Track whether an approved admission has been ported into a Student record.
ALTER TABLE "Admission" ADD COLUMN "posted" BOOLEAN NOT NULL DEFAULT false;

-- Store the guardian relationship chosen during the applicant form (Father/Mother/Custom).
ALTER TABLE "Admission" ADD COLUMN "guardianRelation" TEXT;

-- Allow a free-form multi-line description on cancellation records.
ALTER TABLE "CancelledAdmissions" ADD COLUMN "description" TEXT;

-- Fee structure lookups used to surface an uneditable Fees value on the Pay Now dialog.
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "modeOfAdmission" TEXT NOT NULL,
    "categoryAllotted" TEXT,
    "quota" TEXT,
    "feeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeeStructure_departmentId_modeOfAdmission_categoryAllotte_key" ON "FeeStructure"("departmentId", "modeOfAdmission", "categoryAllotted", "quota");
CREATE INDEX "FeeStructure_modeOfAdmission_idx" ON "FeeStructure"("modeOfAdmission");

ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;