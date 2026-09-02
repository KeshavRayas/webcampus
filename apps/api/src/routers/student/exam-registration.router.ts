import { ExamRegistrationController } from "@webcampus/api/src/controllers/student/exam-registration.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { submitExamRegistrationSchema } from "@webcampus/schemas/student";
import { Router } from "express";

const router: Router = Router();

router.use(protect({ role: "student", permissions: {} }));

router.get("/eligible", ExamRegistrationController.getEligibleCourses);

router.post(
  "/submit",
  validateRequest(submitExamRegistrationSchema),
  ExamRegistrationController.submitExamRegistrations
);

router.get("/history", ExamRegistrationController.getHistory);

export default router;
