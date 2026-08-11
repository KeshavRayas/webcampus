import { FeedbackController } from "@webcampus/api/src/controllers/feedback.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CourseDistributionQuerySchema,
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
  "/configuration/term/:academicTermId/semester/:semesterId",
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
admin.get("/dashboard", FeedbackController.dashboard);
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
admin.delete("/rounds/:id", FeedbackController.deleteRound);
admin.get("/rounds/:roundId/faculties", FeedbackController.roundFaculties);
admin.get(
  "/rounds/:roundId/faculties/:facultyId/courses",
  FeedbackController.facultyCourses
);
admin.get(
  "/rounds/:roundId/faculties/:facultyId/courses/:courseId/sections",
  FeedbackController.courseSections
);
admin.get(
  "/rounds/:roundId/faculties/:facultyId/courses/:courseId/sections/:sectionId/students",
  FeedbackController.sectionStudents
);
admin.get(
  "/rounds/:roundId/course-distribution",
  validateRequest(CourseDistributionQuerySchema, "query"),
  FeedbackController.courseDistribution
);
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
