-- Final contract: lock department ownership columns after successful backfill
-- and validation.

ALTER TABLE "Course"
	ALTER COLUMN "departmentId" SET NOT NULL;

ALTER TABLE "Section"
	ALTER COLUMN "departmentId" SET NOT NULL;

ALTER TABLE "CourseAssignment"
	ALTER COLUMN "departmentId" SET NOT NULL;