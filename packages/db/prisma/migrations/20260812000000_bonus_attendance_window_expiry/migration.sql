-- AlterTable
ALTER TABLE "BonusAttendanceWindow" ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- Backfill existing open windows: anchor the window to its creation time so
-- already-lapsed windows are treated as expired going forward.
UPDATE "BonusAttendanceWindow"
SET
    "openedAt" = "createdAt",
    "expiresAt" = "createdAt" + ("days" * INTERVAL '1 day')
WHERE "isOpen" = true;
