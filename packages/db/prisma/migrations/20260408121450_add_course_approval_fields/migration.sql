-- Add the Course approval enum and fields expected by the Prisma schema.
-- This migration must run before indexes that reference approvalStatus.

DO $$
BEGIN
  CREATE TYPE "public"."CourseApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'NEEDS_REVISION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."Course"
  ADD COLUMN IF NOT EXISTS "approvalStatus" "public"."CourseApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "hasAdminApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hasCoeApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "adminNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "coeNotes" TEXT;
