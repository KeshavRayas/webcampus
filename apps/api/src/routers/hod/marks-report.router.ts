import { Router } from "express";
import { HODMarksReportController } from "../../controllers/hod/marks-report.controller";

const router: Router = Router();

router.get("/filter-options", HODMarksReportController.getFilterOptions);
router.get("/courses", HODMarksReportController.getCourses);
router.get("/sections", HODMarksReportController.getSections);
router.get("/assessments", HODMarksReportController.getAssessments);
router.get("/report", HODMarksReportController.getMarksReport);

export default router;
