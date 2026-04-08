-- Non-invasive index hardening for department context resolution and name-linked lookups.
-- Keeps existing schema and foreign keys intact.

CREATE INDEX IF NOT EXISTS "Section_departmentName_semesterId_cycle_idx"
ON "public"."Section"("departmentName", "semesterId", "cycle");

CREATE INDEX IF NOT EXISTS "Student_departmentName_currentSemester_idx"
ON "public"."Student"("departmentName", "currentSemester");

CREATE INDEX IF NOT EXISTS "Course_departmentName_semesterId_idx"
ON "public"."Course"("departmentName", "semesterId");

CREATE INDEX IF NOT EXISTS "Course_departmentName_semesterId_cycle_approvalStatus_idx"
ON "public"."Course"("departmentName", "semesterId", "cycle", "approvalStatus");

CREATE INDEX IF NOT EXISTS "Admission_departmentId_idx"
ON "public"."Admission"("departmentId");
