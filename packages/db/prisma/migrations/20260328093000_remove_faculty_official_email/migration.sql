-- Remove duplicated faculty email storage; User.email is the single source of truth.
ALTER TABLE "Faculty" DROP COLUMN "officialEmail";
