import { Router } from "express";
import {
  getAttendanceDetailedReport,
  getAttendanceStatusReport,
  getCondonationDetailedReport,
  getCourses,
  getMarksDetailedReport,
  getSections,
} from "../../controllers/admin/academics-report.controller";

const router: Router = Router();

router.get("/courses", getCourses);
router.get("/sections", getSections);
router.get("/attendance/status", getAttendanceStatusReport);
router.get("/attendance/detailed", getAttendanceDetailedReport);
router.get("/marks/detailed", getMarksDetailedReport);
router.get("/condonation/detailed", getCondonationDetailedReport);

export default router;
