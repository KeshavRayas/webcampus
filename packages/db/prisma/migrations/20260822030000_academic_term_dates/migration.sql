-- AcademicTerm gains optional independent dates (supplementary terms run on
-- their own schedule; regular term dates remain unset).
ALTER TABLE "AcademicTerm" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "AcademicTerm" ADD COLUMN "endDate" TIMESTAMP(3);
