import { PromotionController } from "@webcampus/api/src/controllers/admin/promotion.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  PromoteStudentsSchema,
  PromotionCandidatesQuerySchema,
  PromotionHistoryQuerySchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/candidates",
  validateRequest(PromotionCandidatesQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: {
      promotion: ["read"],
    },
  }),
  PromotionController.getCandidates
);

router.post(
  "/",
  validateRequest(PromoteStudentsSchema),
  protect({
    role: "admin",
    permissions: {
      promotion: ["create"],
    },
  }),
  PromotionController.promoteStudents
);

router.get(
  "/history",
  validateRequest(PromotionHistoryQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: {
      promotion: ["read"],
    },
  }),
  PromotionController.getHistory
);

export default router;
