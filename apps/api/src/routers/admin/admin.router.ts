import AcademicsReportRouter from "@webcampus/api/src/routers/admin/academics-report.router";
import AccountsRouter from "@webcampus/api/src/routers/admin/accounts.router";
import AdmissionUserRouter from "@webcampus/api/src/routers/admin/admission-user.router";
import ArchiveRouter from "@webcampus/api/src/routers/admin/archive.router";
import AttendanceWindowRouter from "@webcampus/api/src/routers/admin/attendance-window.router";
import AuditRouter from "@webcampus/api/src/routers/admin/audit.router";
import { bonusAttendanceRouter } from "@webcampus/api/src/routers/admin/bonus-attendance.router";
import CoeRouter from "@webcampus/api/src/routers/admin/coe.router";
import AdminCourseAssignmentRouter from "@webcampus/api/src/routers/admin/course-assignment.router";
import AdminCourseRouter from "@webcampus/api/src/routers/admin/course.router";
import DepartmentRouter from "@webcampus/api/src/routers/admin/department.router";
import ElectiveMappingRouter from "@webcampus/api/src/routers/admin/elective-mapping.router";
import RegistrationTrackingRouter from "@webcampus/api/src/routers/admin/registration-tracking.router";
import RegistrationWindowRouter from "@webcampus/api/src/routers/admin/registration-window.router";
import SemesterRouter from "@webcampus/api/src/routers/admin/semester.router";
import StudentProfileRouter from "@webcampus/api/src/routers/admin/student-profile.router";
import StudentRouter from "@webcampus/api/src/routers/admin/student.router";
import UserRouter from "@webcampus/api/src/routers/admin/user.router";
import WhatsAppRouter from "@webcampus/api/src/routers/admin/whatsapp.router";
import { Router } from "express";
import { getSections } from "../../controllers/admin/section.controller";
import facultyRouter from "./faculty.router";
import HallTicketRouter from "./hall-ticket.router";

const router: Router = Router();

router.use("/user", UserRouter);
router.use("/coe", CoeRouter);
router.use("/accounts", AccountsRouter);
router.use("/admission-users", AdmissionUserRouter);

router.use("/department", DepartmentRouter);
router.use("/academics/reports", AcademicsReportRouter);

router.use("/semester", SemesterRouter);

router.use("/archive", ArchiveRouter);

router.use("/faculty", facultyRouter);

router.use("/student", StudentRouter);
router.use("/students", StudentProfileRouter);

router.use("/course", AdminCourseRouter);

router.use("/course-assignment", AdminCourseAssignmentRouter);

router.use("/elective-mapping", ElectiveMappingRouter);

router.use("/audit", AuditRouter);

router.use("/registration-windows", RegistrationWindowRouter);

router.use("/registration-tracking", RegistrationTrackingRouter);

router.use("/attendance-windows", AttendanceWindowRouter);

router.use("/bonus-attendance", bonusAttendanceRouter);

router.use("/hall-ticket", HallTicketRouter);

router.use("/whatsapp", WhatsAppRouter);

router.get("/sections", getSections);

export default router;
