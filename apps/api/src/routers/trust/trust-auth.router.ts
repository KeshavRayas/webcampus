import { TrustAuthController } from "@webcampus/api/src/controllers/trust/trust-auth.controller";
import { trustAuthMiddleware } from "@webcampus/api/src/middlewares/trust-auth.middleware";
import { validateRequest } from "@webcampus/backend-utils/middlewares";
import { TrustLoginSchema } from "@webcampus/schemas/trust";
import { Router } from "express";

const router: Router = Router();

router.post(
  "/auth/login",
  validateRequest(TrustLoginSchema),
  TrustAuthController.login
);

router.get("/auth/me", trustAuthMiddleware, TrustAuthController.me);

router.post("/auth/logout", TrustAuthController.logout);

export default router;
