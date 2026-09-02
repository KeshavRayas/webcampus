-- Supplementary terms are now parity-scoped: an Odd Supplementary term hosts
-- odd-numbered semesters, an Even Supplementary term hosts even-numbered ones.
-- Parity is optional (legacy supplementary terms keep NULL and stay valid);
-- new supplementary terms must declare it. Uniqueness moves from the table
-- constraint to partial unique indexes so one odd + one even supplementary
-- term can coexist per year while regular odd/even terms keep their rule.

CREATE TYPE "TermParity" AS ENUM ('odd', 'even');

ALTER TABLE "AcademicTerm" ADD COLUMN "parity" "TermParity";

ALTER TABLE "AcademicTerm" DROP CONSTRAINT IF EXISTS "AcademicTerm_type_year_key";

CREATE INDEX "AcademicTerm_type_year_idx" ON "AcademicTerm"("type", "year");

CREATE UNIQUE INDEX "AcademicTerm_regular_type_year_key"
  ON "AcademicTerm"("type", "year")
  WHERE "type" IN ('odd', 'even');

CREATE UNIQUE INDEX "AcademicTerm_supp_year_parity_key"
  ON "AcademicTerm"("year", "parity")
  WHERE "type" = 'supplementary' AND "parity" IS NOT NULL;
