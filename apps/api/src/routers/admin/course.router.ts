import { AdminCourseController } from "@webcampus/api/src/controllers/admin/course.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  AdminCourseBranchQuerySchema,
  AdminCourseByIdQuerySchema,
  AdminCreateCourseSchema,
  AdminDeleteCourseSchema,
  AdminUpdateCourseSchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";

const router: Router = Router();

router.post(
  "/",
  protect({
    role: "admin",
    permissions: {
      courses: ["create"],
    },
  }),
  validateRequest(AdminCreateCourseSchema),
  AdminCourseController.create
);

router.put(
  "/",
  protect({
    role: "admin",
    permissions: {
      courses: ["update"],
    },
  }),
  validateRequest(AdminUpdateCourseSchema),
  AdminCourseController.update
);

router.delete(
  "/",
  protect({
    role: "admin",
    permissions: {
      courses: ["delete"],
    },
  }),
  validateRequest(AdminDeleteCourseSchema),
  AdminCourseController.delete
);

router.get(
  "/branch",
  protect({
    role: "admin",
    permissions: {
      courses: ["read"],
    },
  }),
  validateRequest(AdminCourseBranchQuerySchema, "query"),
  AdminCourseController.getByDepartment
);

router.get(
  "/pe-capacity-summary",
  protect({
    role: "admin",
    permissions: {
      courses: ["read"],
    },
  }),
  validateRequest(AdminCourseBranchQuerySchema, "query"),
  AdminCourseController.getPeCapacitySummary
);

router.get(
  "/:id",
  protect({
    role: "admin",
    permissions: {
      courses: ["read"],
    },
  }),
  validateRequest(AdminCourseByIdQuerySchema, "query"),
  AdminCourseController.getById
);

router.get(
  "/:id/coordinators",
  protect({
    role: "admin",
    permissions: {
      courseCoordinator: ["read"],
    },
  }),
  AdminCourseController.getCoordinators
);

router.put(
  "/:id/coordinators",
  protect({
    role: "admin",
    permissions: {
      courseCoordinator: ["update"],
    },
  }),
  AdminCourseController.updateCoordinators
);

router.get(
  "/:id/mapped-faculty",
  protect({
    role: "admin",
    permissions: {
      courseCoordinator: ["read"],
    },
  }),
  AdminCourseController.getMappedFaculty
);

export default router;
