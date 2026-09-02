import attendanceRouter from "@webcampus/api/src/routers/student/attendance.router";
import courseRegistrationRouter from "@webcampus/api/src/routers/student/course-registration.router";
import examRegistrationRouter from "@webcampus/api/src/routers/student/exam-registration.router";
import feedbackRouter from "@webcampus/api/src/routers/student/feedback.router";
import hallTicketRouter from "@webcampus/api/src/routers/student/hall-ticket.router";
import marksRouter from "@webcampus/api/src/routers/student/marks.router";
import proctorRouter from "@webcampus/api/src/routers/student/proctor.router";
import profileRouter from "@webcampus/api/src/routers/student/profile.router";
import reRegistrationRouter from "@webcampus/api/src/routers/student/re-registration.router";
import supplementaryRouter from "@webcampus/api/src/routers/student/supplementary.router";
import { Router } from "express";

const router: Router = Router();

router.use("/profile", profileRouter);
router.use("/course-registration", courseRegistrationRouter);
router.use("/re-registration", reRegistrationRouter);
router.use("/supplementary", supplementaryRouter);
router.use("/exam-registration", examRegistrationRouter);
router.use("/hall-ticket", hallTicketRouter);
router.use("/attendance", attendanceRouter);
router.use("/marks", marksRouter);
router.use("/feedback", feedbackRouter);
router.use("/proctor", proctorRouter);

export default router;
