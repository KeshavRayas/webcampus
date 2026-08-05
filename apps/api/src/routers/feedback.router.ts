import { FeedbackController } from "@webcampus/api/src/controllers/feedback.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  FeedbackQuestionSetSchema,
  FeedbackReportQuerySchema,
  FeedbackRoundSchema,
  FeedbackRoundUpdateSchema,
} from "@webcampus/schemas/feedback";
import { Router, type Router as ExpressRouter } from "express";

const admin: ExpressRouter = Router();
admin.use(protect({ role: "admin", permissions: { feedback: ["manage"] } }));
admin.get("/configuration/:semesterId", FeedbackController.configuration);
admin.get("/filter-options", FeedbackController.filterOptions);
admin.post(
  "/questions",
  validateRequest(FeedbackQuestionSetSchema),
  FeedbackController.saveQuestions
);
admin.post(
  "/rounds",
  validateRequest(FeedbackRoundSchema),
  FeedbackController.createRound
);
admin.patch(
  "/rounds/:id",
  validateRequest(FeedbackRoundUpdateSchema),
  FeedbackController.updateRound
);
admin.post("/rounds/:id/enable", FeedbackController.enableRound);
admin.post("/rounds/:id/disable", FeedbackController.disableRound);
admin.get(
  "/report",
  validateRequest(FeedbackReportQuerySchema, "query"),
  FeedbackController.report
);

const report: ExpressRouter = Router();
report.use(protect({ permissions: { feedback: ["read"] } }));
report.get("/filter-options", FeedbackController.filterOptions);
report.get(
  "/report",
  validateRequest(FeedbackReportQuerySchema, "query"),
  FeedbackController.report
);

export { admin as adminFeedbackRouter, report as feedbackReportRouter };
