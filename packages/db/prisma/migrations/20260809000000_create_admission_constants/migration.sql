-- Admission constants reference data used to drive the admission dropdowns
-- (categories claimed/allotted, quotas and modes of admission).
CREATE TABLE "AdmissionConstants" (
    "id" TEXT NOT NULL,
    "modeOfAdmission" TEXT NOT NULL,
    "quota" TEXT,
    "categoryClaimed" TEXT NOT NULL,
    "categoryAllotted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionConstants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionConstants_modeOfAdmission_quota_categoryClaimed_c_key" ON "AdmissionConstants"("modeOfAdmission", "quota", "categoryClaimed", "categoryAllotted");

-- CreateIndex
CREATE INDEX "AdmissionConstants_modeOfAdmission_idx" ON "AdmissionConstants"("modeOfAdmission");