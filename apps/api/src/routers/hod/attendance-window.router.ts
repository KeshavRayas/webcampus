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
  validateRequest(HODAttendanceWindowFiltersSchema, "query"),
  protect({
    role: "hod",
    permissions: { freeze: ["read"] },
  }),
  HODAttendanceWindowController.getWindows
);

router.get(
  "/sections",
  validateRequest(HODSectionQuerySchema, "query"),
  protect({
    role: "hod",
    permissions: { freeze: ["read"] },
  }),
  HODAttendanceWindowController.getSections
);

router.post(
  "/freeze",
  validateRequest(HODBulkFreezeSchema),
  protect({
    role: "hod",
    permissions: { freeze: ["lock"] },
  }),
  HODAttendanceWindowController.bulkFreeze
);

router.post(
  "/unfreeze",
  validateRequest(HODBulkUnfreezeSchema),
  protect({
    role: "hod",
    permissions: { freeze: ["lock"] },
  }),
  HODAttendanceWindowController.bulkUnfreeze
);

router.post(
  "/:courseAssignmentId/freeze",
  validateRequest(HODFreezeParamsSchema, "params"),
  protect({
    role: "hod",
    permissions: { freeze: ["lock"] },
  }),
  HODAttendanceWindowController.freezeAssignment
);

router.post(
  "/:courseAssignmentId/unfreeze",
  validateRequest(HODUnfreezeParamsSchema, "params"),
  protect({
    role: "hod",
    permissions: { freeze: ["lock"] },
  }),
  HODAttendanceWindowController.unfreezeAssignment
);

export default router;
