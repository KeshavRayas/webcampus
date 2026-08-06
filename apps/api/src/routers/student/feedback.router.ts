import { FeedbackController } from "@webcampus/api/src/controllers/feedback.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { FeedbackSubmissionSchema } from "@webcampus/schemas/feedback";
import { Router, type Router as ExpressRouter } from "express";

const router: ExpressRouter = Router();
router.use(protect({ role: "student", permissions: { feedback: ["read"] } }));
router.get("/", FeedbackController.studentEligible);
router.post(
  "/submit",
  protect({ role: "student", permissions: { feedback: ["create"] } }),
  validateRequest(FeedbackSubmissionSchema),
  FeedbackController.studentSubmit
);
export default router;
