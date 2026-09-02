import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateBonusAttendanceWindowSchema,
  GetBonusAttendanceWindowsQuerySchema,
  ToggleBonusAttendanceWindowBodySchema,
  ToggleBonusAttendanceWindowParamsSchema,
  UpdateBonusAttendanceWindowBodySchema,
  UpdateBonusAttendanceWindowParamsSchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";
import { BonusAttendanceWindowController } from "../../controllers/admin/bonus-attendance.controller";

const router: Router = Router();

router.get(
  "/",
  protect({ role: "admin", permissions: {} }),
  validateRequest(GetBonusAttendanceWindowsQuerySchema, "query"),
  BonusAttendanceWindowController.getWindows
);

router.post(
  "/",
  protect({ role: "admin", permissions: {} }),
  validateRequest(CreateBonusAttendanceWindowSchema),
  BonusAttendanceWindowController.createWindow
);

router.patch(
  "/:id/toggle",
  protect({ role: "admin", permissions: {} }),
  validateRequest(ToggleBonusAttendanceWindowParamsSchema, "params"),
  validateRequest(ToggleBonusAttendanceWindowBodySchema),
  BonusAttendanceWindowController.toggleWindow
);

router.patch(
  "/:id",
  protect({ role: "admin", permissions: {} }),
  validateRequest(UpdateBonusAttendanceWindowParamsSchema, "params"),
  validateRequest(UpdateBonusAttendanceWindowBodySchema),
  BonusAttendanceWindowController.updateWindow
);

export { router as bonusAttendanceRouter };
