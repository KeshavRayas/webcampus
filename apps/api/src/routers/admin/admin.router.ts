import AdmissionUserRouter from "@webcampus/api/src/routers/admin/admission-user.router";
import CoeRouter from "@webcampus/api/src/routers/admin/coe.router";
import DepartmentRouter from "@webcampus/api/src/routers/admin/department.router";
import SemesterRouter from "@webcampus/api/src/routers/admin/semester.router";
import StudentRouter from "@webcampus/api/src/routers/admin/student.router";
import UserRouter from "@webcampus/api/src/routers/admin/user.router";
import { Router } from "express";
import facultyRouter from "./faculty.router";

const router: Router = Router();

router.use("/user", UserRouter);
router.use("/coe", CoeRouter);
router.use("/admission-users", AdmissionUserRouter);

router.use("/department", DepartmentRouter);

router.use("/semester", SemesterRouter);

router.use("/faculty", facultyRouter);

router.use("/student", StudentRouter);

export default router;
