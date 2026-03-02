import { AdminFacultyController } from "@webcampus/api/src/controllers/admin/faculty.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { createUserSchema } from "@webcampus/schemas/admin";
import { CreateFacultySchema } from "@webcampus/schemas/faculty";
import { Router } from "express";

const router = Router();

router.post(
  "/",
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

export default router;
