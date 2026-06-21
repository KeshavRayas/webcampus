import { AdminAdmissionUserController } from "@webcampus/api/src/controllers/admin/admission-user.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateAdmissionUserSchema,
  UpdateAdmissionUserSchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";
import multer from "multer";

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/",
  upload.single("photo"),
  validateRequest(CreateAdmissionUserSchema),
  protect({
    role: "admin",
    permissions: { user: ["set-role"] },
  }),
  AdminAdmissionUserController.create
);

router.put(
  "/:id",
  upload.single("photo"),
  validateRequest(UpdateAdmissionUserSchema),
  protect({
    role: "admin",
    permissions: { user: ["set-role"] },
  }),
  AdminAdmissionUserController.update
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
