import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";
import { HODAttendanceReportController } from "../../controllers/hod/attendance-report.controller";

const router: Router = Router();

router.get(
  "/filter-options",
  protect({ role: "hod", permissions: { freeze: ["read"] } }),
  HODAttendanceReportController.getFilterOptions
);
router.get(
  "/courses",
  protect({ role: "hod", permissions: { freeze: ["read"] } }),
  HODAttendanceReportController.getCourses
);
router.get(
  "/sections",
  protect({ role: "hod", permissions: { freeze: ["read"] } }),
  HODAttendanceReportController.getSections
);
router.get(
  "/detailed",
  protect({ role: "hod", permissions: { freeze: ["read"] } }),
  HODAttendanceReportController.getDetailedReport
);

export default router;
