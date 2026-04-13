import { CourseRegistrationController } from "@webcampus/api/src/controllers/student/course-registration.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  createCourseRegistrationSchema,
} from "@webcampus/schemas/student";
import { Router } from "express";

const router: Router = Router();

const createMyCourseRegistrationRequestSchema = createCourseRegistrationSchema.pick({
  courseId: true,
  semester: true,
  academicYear: true,
});

router.use(
  protect({
    role: "student",
    permissions: {},
  })
);

router.post(
  "/",
  validateRequest(createMyCourseRegistrationRequestSchema),
  CourseRegistrationController.createMyRegistration
);
router.get("/me", CourseRegistrationController.getMyRegistrations);
router.get("/eligible", CourseRegistrationController.getMyEligibleCourses);

export default router;
