import attendanceReportRouter from "@webcampus/api/src/routers/hod/attendance-report.router";
import AttendanceWindowRouter from "@webcampus/api/src/routers/hod/attendance-window.router";
import condonationRouter from "@webcampus/api/src/routers/hod/condonation.router";
import courseAssignmentRouter from "@webcampus/api/src/routers/hod/course-assignment.router";
import hodCoursesRouter from "@webcampus/api/src/routers/hod/hod-courses.router";
import hodFacultyRouter from "@webcampus/api/src/routers/hod/hod-faculty.router";
import marksReportRouter from "@webcampus/api/src/routers/hod/marks-report.router";
import { Router } from "express";

const router: Router = Router();

router.use("/course-assignment", courseAssignmentRouter);
router.use("/attendance-windows", AttendanceWindowRouter);
router.use("/condonation", condonationRouter);
router.use("/attendance-report", attendanceReportRouter);
router.use("/marks-report", marksReportRouter);
router.use("/faculty", hodFacultyRouter);
router.use("/courses", hodCoursesRouter);

export default router;
