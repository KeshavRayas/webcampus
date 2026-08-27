import { HODCondonationReportController } from "@webcampus/api/src/controllers/hod/condonation-report.controller";
import { HODCondonationController } from "@webcampus/api/src/controllers/hod/condonation.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  HODCondonationAttendanceIdSchema,
  HODCondonationFiltersSchema,
  HODCondonationSemesterQuerySchema,
} from "@webcampus/schemas/hod";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/students",
  protect({
    role: "hod",
    permissions: { freeze: ["read"] },
  }),
  validateRequest(HODCondonationFiltersSchema, "query"),
  HODCondonationController.getStudents
);

router.get(
  "/courses",
  protect({
    role: "hod",
    permissions: { freeze: ["read"] },
  }),
  validateRequest(HODCondonationSemesterQuerySchema, "query"),
  HODCondonationController.getCourses
);

router.patch(
  "/:attendanceId/revoke",
  protect({
    role: "hod",
    permissions: { freeze: ["lock"] },
  }),
  validateRequest(HODCondonationAttendanceIdSchema, "params"),
  HODCondonationController.revokeCondonation
);

router.patch(
  "/:attendanceId",
  protect({
    role: "hod",
    permissions: { freeze: ["lock"] },
  }),
  validateRequest(HODCondonationAttendanceIdSchema, "params"),
  HODCondonationController.approveCondonation
);

router.get(
  "/report",
  protect({ role: "hod", permissions: { freeze: ["read"] } }),
  validateRequest(HODCondonationFiltersSchema, "query"), // Or appropriate schema
  HODCondonationReportController.getCondonedReport
);

export default router;
