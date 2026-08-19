import { AdmissionReportController } from "@webcampus/api/src/controllers/admission/admission-report.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { GetAdmissionReportsQuerySchema } from "@webcampus/schemas/admission";
import { Router } from "express";

const router: Router = Router();

// Paginated report data for the admission reports tab (server-side filtering + pagination)
router.get(
  "/reports",
  validateRequest(GetAdmissionReportsQuerySchema, "query"),
  protect({
    role: ["admin", "admission", "admission-instructor"],
    permissions: {
      admission: ["read"],
    },
  }),
  AdmissionReportController.getAdmissionReports
);

export default router;
