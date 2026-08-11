-- Move course approvals from dual-role flags to single-actor metadata.
ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "approvedByRole" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedByUsername" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedByDisplay" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revisionRequestedByRole" TEXT,
  ADD COLUMN IF NOT EXISTS "revisionNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "revisionRequestedAt" TIMESTAMP(3);

-- Backfill already-approved rows from legacy flags.
UPDATE "Course"
SET
  "approvedByRole" = CASE
    WHEN "hasCoeApproved" = true THEN 'coe'
    WHEN "hasAdminApproved" = true THEN 'admin'
    ELSE NULL
  END,
  "approvedByUsername" = CASE
    WHEN "hasCoeApproved" = true THEN 'COE'
    ELSE NULL
  END,
  "approvedByDisplay" = CASE
    WHEN "hasCoeApproved" = true THEN 'COE'
    WHEN "hasAdminApproved" = true THEN 'Admin'
    ELSE NULL
  END,
  "approvedAt" = CASE
    WHEN "approvalStatus" = 'APPROVED' AND ("hasCoeApproved" = true OR "hasAdminApproved" = true) THEN NOW()
    ELSE NULL
  END
WHERE "approvalStatus" = 'APPROVED';

-- Backfill revision data from legacy role-specific notes with COE precedence.
UPDATE "Course"
SET
  "revisionRequestedByRole" = CASE
    WHEN COALESCE(NULLIF(BTRIM("coeNotes"), ''), NULL) IS NOT NULL THEN 'coe'
    WHEN COALESCE(NULLIF(BTRIM("adminNotes"), ''), NULL) IS NOT NULL THEN 'admin'
    ELSE NULL
  END,
  "revisionNotes" = COALESCE(
    NULLIF(BTRIM("coeNotes"), ''),
    NULLIF(BTRIM("adminNotes"), '')
  ),
  "revisionRequestedAt" = CASE
    WHEN COALESCE(NULLIF(BTRIM("coeNotes"), ''), NULLIF(BTRIM("adminNotes"), '')) IS NOT NULL THEN NOW()
    ELSE NULL
  END
WHERE "approvalStatus" = 'NEEDS_REVISION'
   OR COALESCE(NULLIF(BTRIM("coeNotes"), ''), NULLIF(BTRIM("adminNotes"), '')) IS NOT NULL;

ALTER TABLE "Course"
  DROP COLUMN IF EXISTS "hasAdminApproved",
  DROP COLUMN IF EXISTS "hasCoeApproved",
  DROP COLUMN IF EXISTS "adminNotes",
  DROP COLUMN IF EXISTS "coeNotes";
