import { StudentAttendanceController } from "@webcampus/api/src/controllers/student/attendance.controller";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";

const router: Router = Router();

router.use(
  protect({
    role: "student",
    permissions: {},
  })
);

router.get("/summary", StudentAttendanceController.getSummary);
router.get("/course/:courseId", StudentAttendanceController.getCourseDetails);
router.get("/terms", StudentAttendanceController.getAcademicTerms);

export default router;
