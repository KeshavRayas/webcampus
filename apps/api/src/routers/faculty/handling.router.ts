import { FacultyHandlingController } from "@webcampus/api/src/controllers/faculty/handling.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  FacultyHandlingAssignmentParamsSchema,
  FacultyHandlingQuerySchema,
} from "@webcampus/schemas/faculty";
import { Router } from "express";

const router: Router = Router();

router.use(
  protect({
    role: "faculty",
    permissions: {},
  })
);

router.get(
  "/courses/filter-options",
  FacultyHandlingController.getCourseFilterOptions
);

router.get(
  "/lab/filter-options",
  FacultyHandlingController.getLabFilterOptions
);

router.get(
  "/courses",
  validateRequest(FacultyHandlingQuerySchema, "query"),
  FacultyHandlingController.getCourses
);

router.get(
  "/lab",
  validateRequest(FacultyHandlingQuerySchema, "query"),
  FacultyHandlingController.getLab
);

router.get(
  "/courses/:assignmentId/students",
  validateRequest(FacultyHandlingAssignmentParamsSchema, "params"),
  validateRequest(FacultyHandlingQuerySchema, "query"),
  FacultyHandlingController.getCourseStudents
);

router.get(
  "/lab/:assignmentId/students",
  validateRequest(FacultyHandlingAssignmentParamsSchema, "params"),
  validateRequest(FacultyHandlingQuerySchema, "query"),
  FacultyHandlingController.getLabStudents
);

export default router;
