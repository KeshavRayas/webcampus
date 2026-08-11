-- Gate migration: abort if any department-owned row still cannot be mapped
-- or if course assignments cross department boundaries.

DO $$
DECLARE
	unmapped_courses BIGINT;
	unmapped_sections BIGINT;
	unmapped_assignments BIGINT;
	mismatched_assignments BIGINT;
BEGIN
	SELECT COUNT(*) INTO unmapped_courses
	FROM "Course"
	WHERE "departmentId" IS NULL;

	SELECT COUNT(*) INTO unmapped_sections
	FROM "Section"
	WHERE "departmentId" IS NULL;

	SELECT COUNT(*) INTO unmapped_assignments
	FROM "CourseAssignment"
	WHERE "departmentId" IS NULL;

	SELECT COUNT(*) INTO mismatched_assignments
	FROM "CourseAssignment" ca
	JOIN "Course" c ON c.id = ca."courseId"
	JOIN "Section" s ON s.id = ca."sectionId"
	WHERE ca."departmentId" IS DISTINCT FROM c."departmentId"
		 OR ca."departmentId" IS DISTINCT FROM s."departmentId"
		 OR c."departmentId" IS NULL
		 OR s."departmentId" IS NULL;

	IF unmapped_courses > 0
		 OR unmapped_sections > 0
		 OR unmapped_assignments > 0
		 OR mismatched_assignments > 0 THEN
		RAISE EXCEPTION
			'DepartmentId gate failed: courses=%, sections=%, assignments=%, mismatches=%',
			unmapped_courses,
			unmapped_sections,
			unmapped_assignments,
			mismatched_assignments;
	END IF;
END $$;