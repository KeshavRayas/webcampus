import { FacultyAttendanceSessionController } from "@webcampus/api/src/controllers/faculty/attendance-session.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateOrOpenFacultyAttendanceSessionSchema,
  DeleteFacultyAttendanceSessionParamsSchema,
  FacultyAttendanceSessionDetailQuerySchema,
  FacultyAttendanceSessionStudentsQuerySchema,
  ListFacultyAttendanceSessionsQuerySchema,
  UpdateFacultyAttendanceSessionSchema,
} from "@webcampus/schemas/faculty";
import { Router } from "express";

const router: Router = Router();

router.get("/test-hang", (req, res) => {
  res.json({ ok: true, message: "test route works" });
});

router.use(
  protect({
    role: "faculty",
    permissions: {},
  })
);

router.get(
  "/filter-options",
  FacultyAttendanceSessionController.getFilterOptions
);

router.get(
  "/students",
  validateRequest(FacultyAttendanceSessionStudentsQuerySchema, "query"),
  FacultyAttendanceSessionController.getSessionStudents
);

router.get(
  "/detail",
  validateRequest(FacultyAttendanceSessionDetailQuerySchema, "query"),
  FacultyAttendanceSessionController.getSessionDetail
);

router.post(
  "/",
  validateRequest(CreateOrOpenFacultyAttendanceSessionSchema),
  FacultyAttendanceSessionController.createSession
);

router.patch(
  "/:sessionId",
  validateRequest(UpdateFacultyAttendanceSessionSchema),
  FacultyAttendanceSessionController.updateSession
);

router.get(
  "/",
  validateRequest(ListFacultyAttendanceSessionsQuerySchema, "query"),
  FacultyAttendanceSessionController.listSessions
);

router.delete(
  "/:sessionId",
  validateRequest(DeleteFacultyAttendanceSessionParamsSchema, "params"),
  FacultyAttendanceSessionController.deleteSession
);

export default router;
