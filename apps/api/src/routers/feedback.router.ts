import { FeedbackController } from "@webcampus/api/src/controllers/feedback.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  FeedbackPresetSchema,
  FeedbackReportQuerySchema,
  FeedbackRoundSchema,
  FeedbackRoundUpdateSchema,
  FeedbackTermConfigurationSchema,
} from "@webcampus/schemas/feedback";
import { Router, type Router as ExpressRouter } from "express";

const admin: ExpressRouter = Router();
admin.use(protect({ role: "admin", permissions: { feedback: ["manage"] } }));
admin.get(
  "/configuration/term/:academicTermId",
  FeedbackController.getTermConfiguration
);
admin.post(
  "/configuration/term",
  validateRequest(FeedbackTermConfigurationSchema),
  FeedbackController.configureTerm
);
admin.get("/presets", FeedbackController.presets);
admin.post(
  "/presets",
  validateRequest(FeedbackPresetSchema),
  FeedbackController.createPreset
);
admin.get("/filter-options", FeedbackController.filterOptions);
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
report.use(
  protect({
    role: ["faculty", "hod", "department", "coe", "admin"],
    permissions: { feedback: ["read"] },
  })
);
report.get("/filter-options", FeedbackController.filterOptions);
report.get(
  "/report",
  validateRequest(FeedbackReportQuerySchema, "query"),
  FeedbackController.report
);

export { admin as adminFeedbackRouter, report as feedbackReportRouter };
