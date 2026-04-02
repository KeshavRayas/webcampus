import { DepartmentStudentController } from "@webcampus/api/src/controllers/department/student.controller";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { DepartmentStudentQuerySchema } from "@webcampus/schemas/department";
import { Router } from "express";

const router: Router = Router();

router.use(
  protect({
    role: "department",
    permissions: {
      student: ["read"],
    },
  })
);

router.use((req, res, next) => {
  if (req.method !== "GET") {
    sendResponse({
      res,
      status: "error",
      statusCode: 403,
      message: "Department admins cannot modify students",
      error: "Department admins cannot modify students",
    });
    return;
  }

  next();
});

router.get(
  "/",
  validateRequest(DepartmentStudentQuerySchema, "query"),
  DepartmentStudentController.getAll
);

export default router;
