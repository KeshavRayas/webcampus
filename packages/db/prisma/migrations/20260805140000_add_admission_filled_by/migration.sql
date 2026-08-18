-- AlterTable
ALTER TABLE "Admission" ADD COLUMN "filledById" TEXT;

-- Existing test admissions are attributed to the first available user.
UPDATE "Admission"
SET "filledById" = (SELECT "id" FROM "user" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "filledById" IS NULL;

-- Make the audit owner mandatory for all admissions.
ALTER TABLE "Admission" ALTER COLUMN "filledById" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_filledById_fkey" FOREIGN KEY ("filledById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Admission_filledById_idx" ON "Admission"("filledById");
