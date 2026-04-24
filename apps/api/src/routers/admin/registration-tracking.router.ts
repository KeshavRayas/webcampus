import { RegistrationTrackingController } from "@webcampus/api/src/controllers/admin/registration-tracking.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  GetRegistrationTrackingQuerySchema,
  GetStudentRegisteredCoursesParamsSchema,
  GetStudentRegisteredCoursesQuerySchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/",
  validateRequest(GetRegistrationTrackingQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: {
      registrationWindow: ["read"],
    },
  }),
  RegistrationTrackingController.getStudentRegistrationStatus
);

router.get(
  "/:studentId/courses",
  validateRequest(GetStudentRegisteredCoursesParamsSchema, "params"),
  validateRequest(GetStudentRegisteredCoursesQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: {
      registrationWindow: ["read"],
    },
  }),
  RegistrationTrackingController.getStudentRegisteredCourses
);

export default router;
