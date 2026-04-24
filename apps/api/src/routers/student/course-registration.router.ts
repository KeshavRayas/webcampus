import { CourseRegistrationController } from "@webcampus/api/src/controllers/student/course-registration.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { submitCourseRegistrationSchema } from "@webcampus/schemas/student";
import { Router } from "express";

const router: Router = Router();

router.use(
  protect({
    role: "student",
    permissions: {},
  })
);

router.get("/dashboard", CourseRegistrationController.getDashboard);

router.get("/curriculum", CourseRegistrationController.getCurriculum);

router.post(
  "/submit",
  validateRequest(submitCourseRegistrationSchema),
  CourseRegistrationController.submitRegistration
);

router.get("/enrolled", CourseRegistrationController.getEnrolledCourses);

export default router;
