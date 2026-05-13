-- Refactor Freeze model: replace User relations with scalar audit fields
-- Keeps cascade booleans (facultyFrozen/hodFrozen/adminFrozen) and per-level timestamps
-- Removes frozenByFacultyId, frozenByHodId, frozenByAdminId, userId + their FK constraints
-- Adds FreezeActorRole enum, frozenByRole, frozenByUsername, frozenByDisplay

-- Create FreezeActorRole enum
CREATE TYPE "FreezeActorRole" AS ENUM ('FACULTY', 'HOD', 'ADMIN');

-- Drop foreign key constraints referencing user table
ALTER TABLE "public"."Freeze" DROP CONSTRAINT IF EXISTS "Freeze_frozenByFacultyId_fkey";
ALTER TABLE "public"."Freeze" DROP CONSTRAINT IF EXISTS "Freeze_frozenByHodId_fkey";
ALTER TABLE "public"."Freeze" DROP CONSTRAINT IF EXISTS "Freeze_frozenByAdminId_fkey";
ALTER TABLE "public"."Freeze" DROP CONSTRAINT IF EXISTS "Freeze_userId_fkey";

-- Add new scalar audit columns
ALTER TABLE "public"."Freeze" ADD COLUMN "frozenByRole" "FreezeActorRole";
ALTER TABLE "public"."Freeze" ADD COLUMN "frozenByUsername" TEXT;
ALTER TABLE "public"."Freeze" ADD COLUMN "frozenByDisplay" TEXT;

-- Backfill frozenByRole based on which *Frozen boolean is true (highest precedence wins)
UPDATE "public"."Freeze"
SET "frozenByRole" = 'ADMIN'
WHERE "adminFrozen" = true;

UPDATE "public"."Freeze"
SET "frozenByRole" = 'HOD'
WHERE "hodFrozen" = true AND "adminFrozen" = false;

UPDATE "public"."Freeze"
SET "frozenByRole" = 'FACULTY'
WHERE "facultyFrozen" = true AND "hodFrozen" = false AND "adminFrozen" = false;

-- Backfill frozenByUsername and frozenByDisplay from user table via frozenByAdminId
UPDATE "public"."Freeze" f
SET
  "frozenByUsername" = u.username,
  "frozenByDisplay" = u."displayUsername"
FROM "public"."user" u
WHERE f."frozenByAdminId" = u.id AND f."adminFrozen" = true;

-- Backfill from frozenByHodId
UPDATE "public"."Freeze" f
SET
  "frozenByUsername" = u.username,
  "frozenByDisplay" = u."displayUsername"
FROM "public"."user" u
WHERE f."frozenByHodId" = u.id AND f."hodFrozen" = true AND f."adminFrozen" = false;

-- Backfill from frozenByFacultyId
UPDATE "public"."Freeze" f
SET
  "frozenByUsername" = u.username,
  "frozenByDisplay" = u."displayUsername"
FROM "public"."user" u
WHERE f."frozenByFacultyId" = u.id AND f."facultyFrozen" = true AND f."hodFrozen" = false AND f."adminFrozen" = false;

-- Drop old FK columns
ALTER TABLE "public"."Freeze" DROP COLUMN "frozenByFacultyId";
ALTER TABLE "public"."Freeze" DROP COLUMN "frozenByHodId";
ALTER TABLE "public"."Freeze" DROP COLUMN "frozenByAdminId";
ALTER TABLE "public"."Freeze" DROP COLUMN "userId";
ALTER TABLE "public"."Freeze" DROP COLUMN "frozenAt";
