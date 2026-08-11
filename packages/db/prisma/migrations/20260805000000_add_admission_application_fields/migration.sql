-- AlterTable
ALTER TABLE "Admission"
ADD COLUMN "abcAparId" TEXT,
ADD COLUMN "admissionType" TEXT,
ADD COLUMN "counsellingRound" TEXT,
ADD COLUMN "dateOfAdmission" TIMESTAMP(3),
ADD COLUMN "embassyPermissionLetter" TEXT,
ADD COLUMN "feeReceiptNumber" TEXT,
ADD COLUMN "parentPassportNumber" TEXT,
ADD COLUMN "parentVisaExpiryDate" TIMESTAMP(3),
ADD COLUMN "parentVisaNumber" TEXT,
ADD COLUMN "passportExpiryDate" TIMESTAMP(3),
ADD COLUMN "scholarship" BOOLEAN,
ADD COLUMN "sspId" TEXT,
ADD COLUMN "studiedKannadaIn10th" BOOLEAN,
ADD COLUMN "visaExpiryDate" TIMESTAMP(3),
ADD COLUMN "visaNumber" TEXT;
