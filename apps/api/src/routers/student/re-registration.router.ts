import { ReRegistrationController } from "@webcampus/api/src/controllers/student/re-registration.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { submitReRegistrationSchema } from "@webcampus/schemas/student";
import { Router } from "express";

const router: Router = Router();

router.use(
  protect({
    role: "student",
    permissions: {},
  })
);

router.get("/eligible", ReRegistrationController.getEligibleCourses);

router.post(
  "/submit",
  validateRequest(submitReRegistrationSchema),
  ReRegistrationController.submitReRegistration
);

router.get("/history", ReRegistrationController.getHistory);

export default router;
