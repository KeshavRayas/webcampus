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
  validateRequest(HODCondonationFiltersSchema, "query"),
  protect({
    role: "hod",
    permissions: { freeze: ["read"] },
  }),
  HODCondonationController.getStudents
);

router.get(
  "/courses",
  validateRequest(HODCondonationSemesterQuerySchema, "query"),
  protect({
    role: "hod",
    permissions: { freeze: ["read"] },
  }),
  HODCondonationController.getCourses
);

router.patch(
  "/:attendanceId/revoke",
  validateRequest(HODCondonationAttendanceIdSchema, "params"),
  protect({
    role: "hod",
    permissions: { freeze: ["lock"] },
  }),
  HODCondonationController.revokeCondonation
);

router.patch(
  "/:attendanceId",
  validateRequest(HODCondonationAttendanceIdSchema, "params"),
  protect({
    role: "hod",
    permissions: { freeze: ["lock"] },
  }),
  HODCondonationController.approveCondonation
);

router.get(
  "/report",
  validateRequest(HODCondonationFiltersSchema, "query"), // Or appropriate schema
  protect({ role: "hod", permissions: { freeze: ["read"] } }),
  HODCondonationReportController.getCondonedReport
);

export default router;
