import { validateRequest } from "@webcampus/backend-utils/middlewares";
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
  validateRequest(GetBonusAttendanceWindowsQuerySchema, "query"),
  BonusAttendanceWindowController.getWindows
);

router.post(
  "/",
  validateRequest(CreateBonusAttendanceWindowSchema),
  BonusAttendanceWindowController.createWindow
);

router.patch(
  "/:id/toggle",
  validateRequest(ToggleBonusAttendanceWindowParamsSchema, "params"),
  validateRequest(ToggleBonusAttendanceWindowBodySchema),
  BonusAttendanceWindowController.toggleWindow
);

router.patch(
  "/:id",
  validateRequest(UpdateBonusAttendanceWindowParamsSchema, "params"),
  validateRequest(UpdateBonusAttendanceWindowBodySchema),
  BonusAttendanceWindowController.updateWindow
);

export { router as bonusAttendanceRouter };
