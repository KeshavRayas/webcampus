-- Add the Cycle enum and the missing cycle columns expected by the Prisma schema.
-- This migration must run before any indexes that reference those columns.

DO $$
BEGIN
  CREATE TYPE "public"."Cycle" AS ENUM ('PHYSICS', 'CHEMISTRY', 'NONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."Section"
  ADD COLUMN IF NOT EXISTS "cycle" "public"."Cycle" NOT NULL DEFAULT 'NONE';

ALTER TABLE "public"."Course"
  ADD COLUMN IF NOT EXISTS "cycle" "public"."Cycle" NOT NULL DEFAULT 'NONE';
