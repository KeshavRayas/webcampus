import { AttendanceController } from "@webcampus/api/src/controllers/faculty/attendance.controller";
import { FacultyAttendanceSessionController } from "@webcampus/api/src/controllers/faculty/attendance-session.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateAttendanceSchema,
  CreateOrOpenFacultyAttendanceSessionSchema,
  DeleteFacultyAttendanceSessionParamsSchema,
  FacultyAttendanceDetailedReportQuerySchema,
  FacultyAttendanceSessionDetailQuerySchema,
  FacultyAttendanceSessionStudentsQuerySchema,
  ListFacultyAttendanceSessionsQuerySchema,
  UpdateAttendanceSchema,
} from "@webcampus/schemas/faculty";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/session/test-hang",
  (req, res) => {
    res.json({ ok: true, message: "test route works" });
  }
);

router.use(
  protect({
    role: "faculty",
    permissions: {},
  })
);

router.get(
  "/session/filter-options",
  FacultyAttendanceSessionController.getFilterOptions
);

router.get(
  "/session/students",
  validateRequest(FacultyAttendanceSessionStudentsQuerySchema, "query"),
  FacultyAttendanceSessionController.getSessionStudents
);

router.get(
  "/session/detail",
  validateRequest(FacultyAttendanceSessionDetailQuerySchema, "query"),
  FacultyAttendanceSessionController.getSessionDetail
);

router.post(
  "/session",
  validateRequest(CreateOrOpenFacultyAttendanceSessionSchema),
  FacultyAttendanceSessionController.createOrOpenSession
);

router.get(
  "/session",
  validateRequest(ListFacultyAttendanceSessionsQuerySchema, "query"),
  FacultyAttendanceSessionController.listSessions
);

router.delete(
  "/session/:sessionId",
  validateRequest(DeleteFacultyAttendanceSessionParamsSchema, "params"),
  FacultyAttendanceSessionController.deleteSession
);

router.post(
  "/",
  validateRequest(CreateAttendanceSchema),
  AttendanceController.create
);

router.get("/", AttendanceController.getAll);

router.get(
  "/student/:studentId/course/:courseId",
  AttendanceController.getByStudentAndCourse
);

router.get(
  "/report/detailed",
  validateRequest(FacultyAttendanceDetailedReportQuerySchema, "query"),
  AttendanceController.getDetailedReport
);

router.get("/:id", AttendanceController.getById);

router.put(
  "/:id",
  validateRequest(UpdateAttendanceSchema),
  AttendanceController.update
);

router.delete("/:id", AttendanceController.delete);

export default router;