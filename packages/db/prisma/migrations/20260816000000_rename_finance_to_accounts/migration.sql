-- Rename the Finance module to Accounts across tables, constraints, indexes and columns.
ALTER TABLE "Finance" RENAME TO "Accounts";
ALTER TABLE "FinancePayment" RENAME TO "AccountsPayment";

ALTER TABLE "Accounts" RENAME CONSTRAINT "Finance_pkey" TO "Accounts_pkey";
ALTER TABLE "AccountsPayment" RENAME CONSTRAINT "FinancePayment_pkey" TO "AccountsPayment_pkey";
ALTER TABLE "Accounts" RENAME CONSTRAINT "Finance_studentId_fkey" TO "Accounts_studentId_fkey";
ALTER TABLE "AccountsPayment" RENAME CONSTRAINT "FinancePayment_financeId_fkey" TO "AccountsPayment_accountsId_fkey";

ALTER INDEX "Finance_studentId_academicYear_key" RENAME TO "Accounts_studentId_academicYear_key";
ALTER INDEX "Finance_studentId_idx" RENAME TO "Accounts_studentId_idx";
ALTER INDEX "Finance_academicYear_idx" RENAME TO "Accounts_academicYear_idx";
ALTER INDEX "FinancePayment_financeId_idx" RENAME TO "AccountsPayment_accountsId_idx";
ALTER INDEX "FinancePayment_paidAt_idx" RENAME TO "AccountsPayment_paidAt_idx";

ALTER TABLE "AccountsPayment" RENAME COLUMN "financeId" TO "accountsId";