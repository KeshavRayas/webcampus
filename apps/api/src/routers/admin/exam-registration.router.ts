import { ExamRegistrationAdminController } from "@webcampus/api/src/controllers/admin/exam-registration.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { GetExamRegistrationsQuerySchema } from "@webcampus/schemas/admin";
import { Router } from "express";

const router: Router = Router();

router.use(
  protect({ role: "admin", permissions: { examRegistration: ["read"] } })
);

router.get(
  "/",
  validateRequest(GetExamRegistrationsQuerySchema, "query"),
  ExamRegistrationAdminController.getRegistrations
);

export default router;
