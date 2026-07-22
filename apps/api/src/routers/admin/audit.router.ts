import { AuditController } from "@webcampus/api/src/controllers/admin/audit.controller";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/course/:courseId",
  protect({
    role: "admin",
    permissions: {
      courseApprovalOverride: ["read"],
    },
  }),
  AuditController.getByCourse
);

router.get(
  "/entity/:entityType/:entityId",
  protect({
    role: "admin",
    permissions: {
      courseApprovalOverride: ["read"],
    },
  }),
  AuditController.getByEntity
);

router.get(
  "/group/:changeGroupId",
  protect({
    role: "admin",
    permissions: {
      courseApprovalOverride: ["read"],
    },
  }),
  AuditController.getChangeGroup
);

export default router;
