import attendanceSessionRouter from "@webcampus/api/src/routers/faculty/attendance-session.router";
import handlingRouter from "@webcampus/api/src/routers/faculty/handling.router";
import profileRouter from "@webcampus/api/src/routers/faculty/faculty.router";
import { Router } from "express";

const router: Router = Router();

router.use("/profile", profileRouter);
router.use("/handling", handlingRouter);
router.use("/attendance/session", attendanceSessionRouter);

export default router;
