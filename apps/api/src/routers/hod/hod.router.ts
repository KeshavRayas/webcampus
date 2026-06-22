import AttendanceWindowRouter from "@webcampus/api/src/routers/hod/attendance-window.router";
import courseAssignmentRouter from "@webcampus/api/src/routers/hod/course-assignment.router";
import { Router } from "express";

const router: Router = Router();

router.use("/course-assignment", courseAssignmentRouter);
router.use("/attendance-windows", AttendanceWindowRouter);

export default router;
