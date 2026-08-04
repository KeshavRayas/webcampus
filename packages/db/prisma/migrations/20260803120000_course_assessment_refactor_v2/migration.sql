-- AlterTable
ALTER TABLE "Course"
  ADD COLUMN "theoryMaxExams" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Course"
  RENAME COLUMN "theoryMaxMarks" TO "theoryExamMaxMarks";

ALTER TABLE "Course"
  DROP COLUMN "labCount",
  DROP COLUMN "cieCount";
