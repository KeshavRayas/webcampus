import assessmentRouter from "@webcampus/api/src/routers/faculty/assessment.router";
import attendanceRouter from "@webcampus/api/src/routers/faculty/attendance.router";
import profileRouter from "@webcampus/api/src/routers/faculty/faculty.router";
import handlingRouter from "@webcampus/api/src/routers/faculty/handling.router";
import markRouter from "@webcampus/api/src/routers/faculty/mark.router";
import { Router } from "express";

const router: Router = Router();

router.use("/profile", profileRouter);
router.use("/handling", handlingRouter);
router.use("/attendance", attendanceRouter);
router.use("/assessment", assessmentRouter);
router.use("/marks", markRouter);

export default router;
