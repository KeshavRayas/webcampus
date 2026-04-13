import courseRegistrationRouter from "@webcampus/api/src/routers/student/course-registration.router";
import profileRouter from "@webcampus/api/src/routers/student/profile.router";
import { Router } from "express";

const router: Router = Router();

router.use("/profile", profileRouter);
router.use("/course-registration", courseRegistrationRouter);

export default router;
