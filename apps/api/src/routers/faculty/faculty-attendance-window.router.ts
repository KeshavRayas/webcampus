import { FacultyAttendanceWindowController } from "@webcampus/api/src/controllers/faculty/faculty-attendance-window.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  FacultyAttendanceWindowFiltersSchema,
  FacultyBulkFreezeSchema,
  FacultySectionQuerySchema,
  FreezeParamsSchema,
} from "@webcampus/schemas/faculty";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/sections",
  validateRequest(FacultySectionQuerySchema, "query"),
  protect({
    role: "faculty",
    permissions: {
      freeze: ["read"],
    },
  }),
  FacultyAttendanceWindowController.getSections
);

router.get(
  "/",
  validateRequest(FacultyAttendanceWindowFiltersSchema, "query"),
  protect({
    role: "faculty",
    permissions: {
      freeze: ["read"],
    },
  }),
  FacultyAttendanceWindowController.getWindows
);

router.post(
  "/course-assignment/:courseAssignmentId/freeze",
  validateRequest(FreezeParamsSchema, "params"),
  protect({
    role: "faculty",
    permissions: {
      freeze: ["lock"],
    },
  }),
  FacultyAttendanceWindowController.freezeAssignment
);

router.post(
  "/elective-batch/:electiveBatchFacultyId/freeze",
  validateRequest(FreezeParamsSchema, "params"),
  protect({
    role: "faculty",
    permissions: {
      freeze: ["lock"],
    },
  }),
  FacultyAttendanceWindowController.freezeAssignment
);

router.post(
  "/freeze-filtered",
  validateRequest(FacultyBulkFreezeSchema),
  protect({
    role: "faculty",
    permissions: {
      freeze: ["lock"],
    },
  }),
  FacultyAttendanceWindowController.bulkFreeze
);

export default router;
