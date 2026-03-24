import { AdminAdmissionUserController } from "@webcampus/api/src/controllers/admin/admission-user.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { CreateAdmissionUserSchema } from "@webcampus/schemas/admin";
import { Router } from "express";

const router = Router();

router.post(
  "/",
  validateRequest(CreateAdmissionUserSchema),
  protect({
    role: "admin",
    permissions: { user: ["set-role"] },
  }),
  AdminAdmissionUserController.create
);

router.get(
  "/",
  protect({
    role: "admin",
    permissions: { user: [] as const },
  }),
  AdminAdmissionUserController.getAll
);

router.delete(
  "/:id",
  protect({
    role: "admin",
    permissions: { user: ["delete"] },
  }),
  AdminAdmissionUserController.delete
);

export default router;
