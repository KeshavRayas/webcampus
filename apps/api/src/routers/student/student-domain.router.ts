import courseRegistrationRouter from "@webcampus/api/src/routers/student/course-registration.router";
import hallTicketRouter from "@webcampus/api/src/routers/student/hall-ticket.router";
import profileRouter from "@webcampus/api/src/routers/student/profile.router";
import { Router } from "express";

const router: Router = Router();

router.use("/profile", profileRouter);
router.use("/course-registration", courseRegistrationRouter);
router.use("/hall-ticket", hallTicketRouter);

export default router;
