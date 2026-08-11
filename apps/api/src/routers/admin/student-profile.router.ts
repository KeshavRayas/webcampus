import { AdminStudentController } from "@webcampus/api/src/controllers/admin/student.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { UpdateStudentProfileSchema } from "@webcampus/schemas/student";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/:id/profile",
  protect({
    role: "admin",
    permissions: {},
  }),
  AdminStudentController.getProfile
);

router.put(
  "/:id/profile",
  protect({
    role: "admin",
    permissions: {},
  }),
  validateRequest(UpdateStudentProfileSchema),
  AdminStudentController.updateProfile
);

export default router;
