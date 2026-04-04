import { AdminCourseController } from "@webcampus/api/src/controllers/admin/course.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  AdminCourseBranchQuerySchema,
  AdminCreateCourseSchema,
  AdminDeleteCourseSchema,
  AdminUpdateCourseSchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";

const router: Router = Router();

router.post(
  "/",
  validateRequest(AdminCreateCourseSchema),
  protect({
    role: "admin",
    permissions: {
      courses: ["create"],
    },
  }),
  AdminCourseController.create
);

router.put(
  "/",
  validateRequest(AdminUpdateCourseSchema),
  protect({
    role: "admin",
    permissions: {
      courses: ["update"],
    },
  }),
  AdminCourseController.update
);

router.delete(
  "/",
  validateRequest(AdminDeleteCourseSchema),
  protect({
    role: "admin",
    permissions: {
      courses: ["delete"],
    },
  }),
  AdminCourseController.delete
);

router.get(
  "/branch",
  validateRequest(AdminCourseBranchQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: {
      courses: ["read"],
    },
  }),
  AdminCourseController.getByDepartment
);

router.get(
  "/:id",
  protect({
    role: "admin",
    permissions: {
      courses: ["read"],
    },
  }),
  AdminCourseController.getById
);

export default router;
