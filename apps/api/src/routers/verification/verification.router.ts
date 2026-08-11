import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";
import {
  listVerificationLogs,
  listVerificationSettings,
  upsertVerificationSetting,
  verifyHallTicket,
} from "../../controllers/verification/verification.controller";

const router: Router = Router();

router.use(
  protect({
    role: ["admin", "hod", "faculty"],
    permissions: {},
  })
);

router.post("/verify", verifyHallTicket);

router.get("/settings", listVerificationSettings);
router.patch("/settings", upsertVerificationSetting);

router.get("/logs", listVerificationLogs);

export default router;
