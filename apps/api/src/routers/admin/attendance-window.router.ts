import { AttendanceWindowController } from "@webcampus/api/src/controllers/admin/attendance-window.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  AdminAttendanceWindowFiltersSchema,
  AdminBulkFreezeSchema,
  AdminBulkUnfreezeSchema,
  AdminFreezeParamsSchema,
  AdminUnfreezeParamsSchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/",
  validateRequest(AdminAttendanceWindowFiltersSchema, "query"),
  protect({
    role: "admin",
    permissions: {
      freeze: ["read"],
    },
  }),
  AttendanceWindowController.getWindows
);

router.post(
  "/freeze",
  validateRequest(AdminBulkFreezeSchema),
  protect({
    role: "admin",
    permissions: {
      freeze: ["lock"],
    },
  }),
  AttendanceWindowController.bulkFreeze
);

router.post(
  "/unfreeze",
  validateRequest(AdminBulkUnfreezeSchema),
  protect({
    role: "admin",
    permissions: {
      freeze: ["lock"],
    },
  }),
  AttendanceWindowController.bulkUnfreeze
);

router.post(
  "/:courseAssignmentId/freeze",
  validateRequest(AdminFreezeParamsSchema, "params"),
  protect({
    role: "admin",
    permissions: {
      freeze: ["lock"],
    },
  }),
  AttendanceWindowController.freezeAssignment
);

router.post(
  "/:courseAssignmentId/unfreeze",
  validateRequest(AdminUnfreezeParamsSchema, "params"),
  protect({
    role: "admin",
    permissions: {
      freeze: ["lock"],
    },
  }),
  AttendanceWindowController.unfreezeAssignment
);

export default router;
