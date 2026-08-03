import AdmissionUserRouter from "@webcampus/api/src/routers/admin/admission-user.router";
import AttendanceWindowRouter from "@webcampus/api/src/routers/admin/attendance-window.router";
import AuditRouter from "@webcampus/api/src/routers/admin/audit.router";
import CoeRouter from "@webcampus/api/src/routers/admin/coe.router";
import AdminCourseAssignmentRouter from "@webcampus/api/src/routers/admin/course-assignment.router";
import AdminCourseRouter from "@webcampus/api/src/routers/admin/course.router";
import DepartmentRouter from "@webcampus/api/src/routers/admin/department.router";
import FinanceRouter from "@webcampus/api/src/routers/admin/finance.router";
import RegistrationTrackingRouter from "@webcampus/api/src/routers/admin/registration-tracking.router";
import RegistrationWindowRouter from "@webcampus/api/src/routers/admin/registration-window.router";
import SemesterRouter from "@webcampus/api/src/routers/admin/semester.router";
import StudentRouter from "@webcampus/api/src/routers/admin/student.router";
import UserRouter from "@webcampus/api/src/routers/admin/user.router";
import { Router } from "express";
import { getSections } from "../../controllers/admin/section.controller";
import facultyRouter from "./faculty.router";
import HallTicketRouter from "./hall-ticket.router";

const router: Router = Router();

router.use("/user", UserRouter);
router.use("/coe", CoeRouter);
router.use("/finance", FinanceRouter);
router.use("/admission-users", AdmissionUserRouter);

router.use("/department", DepartmentRouter);

router.use("/semester", SemesterRouter);

router.use("/faculty", facultyRouter);

router.use("/student", StudentRouter);

router.use("/course", AdminCourseRouter);

router.use("/course-assignment", AdminCourseAssignmentRouter);

router.use("/audit", AuditRouter);

router.use("/registration-windows", RegistrationWindowRouter);

router.use("/registration-tracking", RegistrationTrackingRouter);

router.use("/attendance-windows", AttendanceWindowRouter);

router.use("/hall-ticket", HallTicketRouter);

router.get("/sections", getSections);

export default router;
