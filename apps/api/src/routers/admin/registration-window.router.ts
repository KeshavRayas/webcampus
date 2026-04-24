import { RegistrationWindowController } from "@webcampus/api/src/controllers/admin/registration-window.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateRegistrationWindowSchema,
  GetRegistrationWindowsQuerySchema,
  RegistrationWindowCoursesParamsSchema,
  ToggleRegistrationWindowBodySchema,
  ToggleRegistrationWindowParamsSchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/",
  validateRequest(GetRegistrationWindowsQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: {
      registrationWindow: ["read"],
    },
  }),
  RegistrationWindowController.getWindows
);

router.post(
  "/",
  validateRequest(CreateRegistrationWindowSchema),
  protect({
    role: "admin",
    permissions: {
      registrationWindow: ["create"],
    },
  }),
  RegistrationWindowController.createWindow
);

router.patch(
  "/:id/toggle",
  validateRequest(ToggleRegistrationWindowParamsSchema, "params"),
  validateRequest(ToggleRegistrationWindowBodySchema),
  protect({
    role: "admin",
    permissions: {
      registrationWindow: ["update"],
    },
  }),
  RegistrationWindowController.toggleWindow
);

router.get(
  "/:id/courses",
  validateRequest(RegistrationWindowCoursesParamsSchema, "params"),
  protect({
    role: "admin",
    permissions: {
      registrationWindow: ["read"],
    },
  }),
  RegistrationWindowController.getApprovedCourses
);

export default router;
