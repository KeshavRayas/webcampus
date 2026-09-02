import { SupplementaryController } from "@webcampus/api/src/controllers/student/supplementary.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { submitSupplementarySchema } from "@webcampus/schemas/student";
import { Router } from "express";

const router: Router = Router();

router.use(protect({ role: "student", permissions: {} }));

router.get("/eligible", SupplementaryController.getEligibleCourses);

router.post(
  "/submit",
  validateRequest(submitSupplementarySchema),
  SupplementaryController.submitSupplementary
);

router.get("/history", SupplementaryController.getHistory);

export default router;
