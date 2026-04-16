import { AssessmentController } from "@webcampus/api/src/controllers/faculty/assessment.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { CreateAssessmentSchema } from "@webcampus/schemas/faculty";
import { Router } from "express";

const router: Router = Router();

router.use(
  protect({
    role: "faculty",
    permissions: {},
  })
);

router.get("/terms", AssessmentController.getAcademicTerms);

router.get("/coordinated-courses", AssessmentController.getCoordinatedCourses);

router.post(
  "/",
  validateRequest(CreateAssessmentSchema),
  AssessmentController.createAssessment
);

router.get("/:id", AssessmentController.getAssessmentById);

export default router;
