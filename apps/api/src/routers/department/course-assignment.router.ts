import { CourseAssignmentController } from "@webcampus/api/src/controllers/department/course-assignment.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CourseMappingByCourseQuerySchema,
  CourseMappingStatusQuerySchema,
  UpsertCourseMappingSchema,
} from "@webcampus/schemas/department";
import { Router } from "express";

const router: Router = Router();

// GET /status — mapping status for all courses in a semester
router.get(
  "/status",
  validateRequest(CourseMappingStatusQuerySchema, "query"),
  protect({
    role: "department",
    permissions: {
      courseAssignment: ["read"],
    },
  }),
  CourseAssignmentController.getMappingStatus
);

// GET /by-course — existing mappings for a specific course
router.get(
  "/by-course",
  protect({
    role: "department",
    permissions: {
      courseAssignment: ["read"],
    },
  }),
  CourseAssignmentController.getMappingByCourse
);

// POST /upsert — save/update course mapping
router.post(
  "/upsert",
  validateRequest(UpsertCourseMappingSchema),
  protect({
    role: "department",
    permissions: {
      courseAssignment: ["create"],
    },
  }),
  CourseAssignmentController.upsertMapping
);

// GET /faculty — faculty available for mapping
router.get(
  "/faculty",
  protect({
    role: "department",
    permissions: {
      faculty: ["read"],
    },
  }),
  CourseAssignmentController.getFacultyForMapping
);

// GET /sections — sections with batches for the mapping grid
router.get(
  "/sections",
  protect({
    role: "department",
    permissions: {
      section: ["read"],
    },
  }),
  CourseAssignmentController.getSectionsForMapping
);

export default router;
