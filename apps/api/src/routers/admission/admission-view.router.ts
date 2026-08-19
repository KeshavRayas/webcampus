import { AdmissionViewController } from "@webcampus/api/src/controllers/admission/admission-view.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  AdmissionActionParamSchema,
  ApproveAdmissionSchema,
  GetAdmissionsQuerySchema,
  PortStudentsSchema,
} from "@webcampus/schemas/admission";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/",
  validateRequest(GetAdmissionsQuerySchema, "query"),
  protect({
    role: ["admin", "admission", "admission-instructor"],
    permissions: {
      admission: ["read"],
    },
  }),
  AdmissionViewController.getAdmissions
);

// Endpoint to get all admissions for a specific semester
router.get(
  "/semester/:semesterId",
  protect({
    role: ["admin", "admission", "admission-instructor"],
    permissions: {
      admission: ["read"],
    },
  }),
  AdmissionViewController.getBySemester
);

// Endpoint for admin to delete an admission record (and its S3 files)
router.delete(
  "/:id",
  protect({
    role: ["admin", "admission"],
    permissions: {
      admission: ["delete"],
    },
  }),
  AdmissionViewController.deleteAdmission
);

router.patch(
  "/:id/approve",
  validateRequest(AdmissionActionParamSchema, "params"),
  validateRequest(ApproveAdmissionSchema),
  protect({
    role: ["admin", "admission"],
    permissions: {
      admission: ["update"],
    },
  }),
  AdmissionViewController.approve
);

router.patch(
  "/:id/reject",
  validateRequest(AdmissionActionParamSchema, "params"),
  protect({
    role: ["admin", "admission"],
    permissions: {
      admission: ["update"],
    },
  }),
  AdmissionViewController.reject
);

router.post(
  "/port",
  validateRequest(PortStudentsSchema),
  protect({
    role: ["admin", "admission"],
    permissions: {
      admission: ["port"],
    },
  }),
  AdmissionViewController.portStudents
);

router.post(
  "/:id/port",
  validateRequest(AdmissionActionParamSchema, "params"),
  protect({
    role: ["admin", "admission"],
    permissions: {
      admission: ["port"],
    },
  }),
  AdmissionViewController.portAdmission
);

export default router;
