import { HODAttendanceWindowController } from "@webcampus/api/src/controllers/hod/attendance-window.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  HODAttendanceWindowFiltersSchema,
  HODBulkFreezeSchema,
  HODBulkUnfreezeSchema,
  HODFreezeParamsSchema,
  HODSectionQuerySchema,
  HODUnfreezeParamsSchema,
} from "@webcampus/schemas/hod";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/",
  protect({
    role: "hod",
    permissions: { freeze: ["read"] },
  }),
  validateRequest(HODAttendanceWindowFiltersSchema, "query"),
  HODAttendanceWindowController.getWindows
);

router.get(
  "/sections",
  protect({
    role: "hod",
    permissions: { freeze: ["read"] },
  }),
  validateRequest(HODSectionQuerySchema, "query"),
  HODAttendanceWindowController.getSections
);

router.post(
  "/freeze",
  protect({
    role: "hod",
    permissions: { freeze: ["lock"] },
  }),
  validateRequest(HODBulkFreezeSchema),
  HODAttendanceWindowController.bulkFreeze
);

router.post(
  "/unfreeze",
  protect({
    role: "hod",
    permissions: { freeze: ["lock"] },
  }),
  validateRequest(HODBulkUnfreezeSchema),
  HODAttendanceWindowController.bulkUnfreeze
);

router.post(
  "/course-assignment/:courseAssignmentId/freeze",
  protect({
    role: "hod",
    permissions: { freeze: ["lock"] },
  }),
  validateRequest(HODFreezeParamsSchema, "params"),
  HODAttendanceWindowController.freezeAssignment
);

router.post(
  "/course-assignment/:courseAssignmentId/unfreeze",
  protect({
    role: "hod",
    permissions: { freeze: ["lock"] },
  }),
  validateRequest(HODUnfreezeParamsSchema, "params"),
  HODAttendanceWindowController.unfreezeAssignment
);

router.post(
  "/elective-batch/:electiveBatchFacultyId/freeze",
  protect({
    role: "hod",
    permissions: { freeze: ["lock"] },
  }),
  validateRequest(HODFreezeParamsSchema, "params"),
  HODAttendanceWindowController.freezeAssignment
);

router.post(
  "/elective-batch/:electiveBatchFacultyId/unfreeze",
  protect({
    role: "hod",
    permissions: { freeze: ["lock"] },
  }),
  validateRequest(HODUnfreezeParamsSchema, "params"),
  HODAttendanceWindowController.unfreezeAssignment
);

export default router;
