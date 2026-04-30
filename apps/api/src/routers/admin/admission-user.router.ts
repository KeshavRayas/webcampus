import { AdminAdmissionUserController } from "@webcampus/api/src/controllers/admin/admission-user.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { CreateAdmissionUserSchema } from "@webcampus/schemas/admin";
import { Router } from "express";
import multer from "multer"; // <-- 1. Import multer

const router: Router = Router();

// 2. Initialize multer to keep the uploaded file in memory
const upload = multer({ storage: multer.memoryStorage() });

// --- CREATE ROUTE ---
router.post(
  "/",
  upload.single("photo"), // <-- 3. Catch the "photo" file from FormData before validation
  validateRequest(CreateAdmissionUserSchema),
  protect({
    role: "admin",
    permissions: { user: ["set-role"] },
  }),
  AdminAdmissionUserController.create
);

// --- GET ALL ROUTE ---
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
  // Note: If you have an UpdateAdmissionUserSchema, you can add validateRequest() here!
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
