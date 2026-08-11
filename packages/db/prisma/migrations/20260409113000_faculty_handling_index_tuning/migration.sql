-- Targeted index tuning for faculty handling queries.
-- Keeps existing relations/constraints unchanged.

CREATE INDEX "Batch_sectionId_idx" ON "Batch"("sectionId");

CREATE INDEX "StudentSection_sectionId_semester_academicYear_idx"
ON "StudentSection"("sectionId", "semester", "academicYear");

CREATE INDEX "CourseAssignment_courseId_semester_academicYear_idx"
ON "CourseAssignment"("courseId", "semester", "academicYear");
