import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";
import { HODMarksReportController } from "../../controllers/hod/marks-report.controller";

const router: Router = Router();

router.get(
  "/filter-options",
  protect({ role: "hod", permissions: { freeze: ["read"] } }),
  HODMarksReportController.getFilterOptions
);
router.get(
  "/courses",
  protect({ role: "hod", permissions: { freeze: ["read"] } }),
  HODMarksReportController.getCourses
);
router.get(
  "/sections",
  protect({ role: "hod", permissions: { freeze: ["read"] } }),
  HODMarksReportController.getSections
);
router.get(
  "/assessments",
  protect({ role: "hod", permissions: { freeze: ["read"] } }),
  HODMarksReportController.getAssessments
);
router.get(
  "/report",
  protect({ role: "hod", permissions: { freeze: ["read"] } }),
  HODMarksReportController.getMarksReport
);

export default router;
