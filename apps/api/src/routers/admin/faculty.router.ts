import { AdminFacultyController } from "@webcampus/api/src/controllers/admin/faculty.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { createUserSchema } from "@webcampus/schemas/admin";
import {
  CreateFacultySchema,
  UpdateFacultySchema,
} from "@webcampus/schemas/faculty";
import { Router } from "express";
import multer from "multer";

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get(
  "/",
  protect({
    role: "admin",
    permissions: {
      faculty: ["read"],
    },
  }),
  AdminFacultyController.getAll
);

router.post(
  "/",
  upload.single("image"),
  validateRequest(CreateFacultySchema.extend(createUserSchema.shape)),
  protect({
    role: "admin",
    permissions: {
      user: ["set-role"],
      faculty: ["create"],
    },
  }),
  AdminFacultyController.create
);

router.get(
  "/department/:departmentId",
  protect({
    role: "admin",
    permissions: {
      faculty: ["read"],
    },
  }),
  AdminFacultyController.getByDepartment
);

router.put(
  "/:id",
  upload.single("image"),
  validateRequest(UpdateFacultySchema),
  protect({
    role: "admin",
    permissions: { faculty: ["update"] },
  }),
  AdminFacultyController.update
);

router.delete(
  "/:id",
  protect({
    role: "admin",
    permissions: { faculty: ["delete"] },
  }),
  AdminFacultyController.delete
);

router.post(
  "/:id/hod",
  validateRequest(createUserSchema.omit({ username: true, role: true })),
  protect({
    role: "admin",
    permissions: { user: ["set-role"] },
  }),
  AdminFacultyController.createHodAccount
);

router.put(
  "/:id/hod",
  protect({
    role: "admin",
    permissions: { user: ["set-role"] },
  }),
  AdminFacultyController.reassignHodAccount
);

export default router;
