import { AdminStudentController } from "@webcampus/api/src/controllers/admin/student.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { GetAdminStudentsQuerySchema } from "@webcampus/schemas/admin";
import { Router } from "express";

const router = Router();

router.get(
  "/",
  validateRequest(GetAdminStudentsQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: {
      student: ["read"],
    },
  }),
  AdminStudentController.getAll
);

router.delete(
  "/:id",
  protect({
    role: "admin",
    permissions: {
      student: ["delete"],
    },
  }),
  AdminStudentController.delete
);

export default router;
