import { Router } from "express";
import { HODAttendanceReportController } from "../../controllers/hod/attendance-report.controller";

const router: Router = Router();

router.get("/filter-options", HODAttendanceReportController.getFilterOptions);
router.get("/courses", HODAttendanceReportController.getCourses);
router.get("/sections", HODAttendanceReportController.getSections);
router.get("/detailed", HODAttendanceReportController.getDetailedReport);

export default router;
