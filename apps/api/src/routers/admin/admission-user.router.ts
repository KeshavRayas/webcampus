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

// 2. Initialize multer to keep the uploaded file in memory
// const upload = multer({ storage: multer.memoryStorage() });

// removed the duplicate line of code

// --- CREATE ROUTE ---
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

// --- UPDATE/EDIT ROUTE (Newly Added!) ---
router.patch(
  "/:id",
  upload.single("photo"), // <-- Catch the "photo" file on edits
  // Added missing Zod val idation request for the UpdateAdmissionUserSchema
  validateRequest(UpdateAdmissionUserSchema),
  protect({
    role: "admin",
    permissions: { user: ["set-role"] }, // Assuming editing requires the same permissions
  }),
  AdminAdmissionUserController.update // Make sure this method exists in your controller!
);

// --- DELETE ROUTE ---
router.delete(
  "/:id",
  protect({
    role: "admin",
    permissions: { user: ["delete"] },
  }),
  AdminAdmissionUserController.delete
);

export default router;
