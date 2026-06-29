import AttendanceWindowRouter from "@webcampus/api/src/routers/hod/attendance-window.router";
import condonationRouter from "@webcampus/api/src/routers/hod/condonation.router";
import courseAssignmentRouter from "@webcampus/api/src/routers/hod/course-assignment.router";
import { Router } from "express";

const router: Router = Router();

router.use("/course-assignment", courseAssignmentRouter);
router.use("/attendance-windows", AttendanceWindowRouter);
router.use("/condonation", condonationRouter);

export default router;
