import DepartmentCourseRouter from "@webcampus/api/src/routers/department/course.router";
import DepartmentFacultyRouter from "@webcampus/api/src/routers/department/faculty.router";
import DepartmentHODRouter from "@webcampus/api/src/routers/department/hod.router";
import DepartmentSectionAssignmentRouter from "@webcampus/api/src/routers/department/section-assignment.router";
import DepartmentSectionRouter from "@webcampus/api/src/routers/department/section.router";
import DepartmentStudentRouter from "@webcampus/api/src/routers/department/student.router";
import { Router } from "express";

const router = Router();

router.use("/course", DepartmentCourseRouter);

router.use("/faculty", DepartmentFacultyRouter);

router.use("/hod", DepartmentHODRouter);

router.use("/section", DepartmentSectionRouter);

router.use("/section-assignment", DepartmentSectionAssignmentRouter);

router.use("/student", DepartmentStudentRouter);

export default router;
