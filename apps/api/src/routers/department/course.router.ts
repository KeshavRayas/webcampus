import { CourseController } from "@webcampus/api/src/controllers/department/course.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { StringParamSchema } from "@webcampus/schemas/common";
import {
  CreateCourseSchema,
  DeleteCourseSchema,
  UpdateCourseSchema,
} from "@webcampus/schemas/department";
import { Router } from "express";

const router: Router = Router();

router.post(
  "/",
  validateRequest(CreateCourseSchema),
  protect({
    role: "department",
    permissions: {
      courses: ["create"],
    },
  }),
  CourseController.create
);

router.put(
  "/",
  validateRequest(UpdateCourseSchema),
  protect({
    role: "department",
    permissions: {
      courses: ["update"],
    },
  }),
  CourseController.update
);

router.delete(
  "/",
  validateRequest(DeleteCourseSchema),
  protect({
    role: "department",
    permissions: {
      courses: ["delete"],
    },
  }),
  CourseController.delete
);

router.get(
  "/branch",
  validateRequest(StringParamSchema, "query"),
  protect({
    role: "department",
    permissions: {
      courses: ["read"],
    },
  }),
  CourseController.getByBranch
);

export default router;
