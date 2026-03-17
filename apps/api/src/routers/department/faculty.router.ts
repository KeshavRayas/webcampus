import { DepartmentFacultyController } from "@webcampus/api/src/controllers/department/faculty.controller";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { DepartmentFacultyQuerySchema } from "@webcampus/schemas/department";
import { Router } from "express";

const router = Router();

router.use(
  protect({
    role: "department",
    permissions: {
      faculty: ["read"],
    },
  })
);

router.use((req, res, next) => {
  if (req.method !== "GET") {
    sendResponse({
      res,
      status: "error",
      statusCode: 403,
      message: "Department admins cannot modify faculty",
      error: "Department admins cannot modify faculty",
    });
    return;
  }

  next();
});

router.get(
  "/",
  validateRequest(DepartmentFacultyQuerySchema, "query"),
  DepartmentFacultyController.getAll
);

export default router;
