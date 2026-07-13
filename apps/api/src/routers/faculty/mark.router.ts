import { MarkController } from "@webcampus/api/src/controllers/faculty/mark.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateMarkSchema,
  SaveAssessmentMarksSchema,
  UpdateMarkSchema,
} from "@webcampus/schemas/faculty";
import { Router } from "express";

const router: Router = Router();

// All mark routes require faculty authentication
router.use(
  protect({
    role: "faculty",
    permissions: {},
  })
);

// Assessment marks entry routes (must be declared BEFORE the generic /:id route
// to prevent Express from matching "assessments" as a route parameter)
router.get("/assessments/dashboard", MarkController.getMarksDashboard);

router.get(
  "/assessments/:assessmentId/marks",
  MarkController.getAssessmentWithMarks
);

router.post(
  "/assessments/save-marks",
  validateRequest(SaveAssessmentMarksSchema),
  MarkController.saveAssessmentMarks
);

// Marks Report routes
router.get(
  "/report/filter-options",
  MarkController.getMarksReportFilterOptions
);
router.get("/report", MarkController.getMarksReport);

// Basic mark CRUD routes
router.post("/", validateRequest(CreateMarkSchema), MarkController.create);
router.get("/", MarkController.getAll);
router.get("/:id", MarkController.getById);
router.get(
  "/student/:studentId/course/:courseId",
  MarkController.getByStudentAndCourse
);
router.put("/:id", validateRequest(UpdateMarkSchema), MarkController.update);
router.delete("/:id", MarkController.delete);

export default router;
