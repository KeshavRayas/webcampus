ALTER TABLE "Course" ADD COLUMN "theoryCieContribution" INTEGER NOT NULL DEFAULT 0;

UPDATE "Course"
SET "theoryCieContribution" = GREATEST("cieMaxMarks" - "labMaxMarks" - "aatMaxMarks", 0);
