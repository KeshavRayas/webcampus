import { FacultyAttendanceSessionController } from "@webcampus/api/src/controllers/faculty/attendance-session.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateOrOpenFacultyAttendanceSessionSchema,
  DeleteFacultyAttendanceSessionParamsSchema,
  FacultyAttendanceSessionDetailQuerySchema,
  FacultyAttendanceSessionStudentsQuerySchema,
  ListFacultyAttendanceSessionsQuerySchema,
} from "@webcampus/schemas/faculty";
import { Router } from "express";

const router: Router = Router();

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
  FacultyAttendanceSessionController.createOrOpenSession
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
