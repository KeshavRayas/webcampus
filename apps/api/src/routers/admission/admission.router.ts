import { DepartmentController } from "@webcampus/api/src/controllers/admin/department.controller";
import { AdmissionController } from "@webcampus/api/src/controllers/admission/admission.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  AdmissionActionParamSchema,
  CancelAdmissionSchema,
  CreateAdmissionShellSchema,
  GetAdmissionsQuerySchema,
  PortStudentsSchema,
} from "@webcampus/schemas/admission";
import { Router } from "express";
import multer from "multer";
import admissionUploadRouter from "./admission.upload.router";

const upload = multer({ storage: multer.memoryStorage() });
const applicationUploadFields = [
  { name: "class10thMarksPdf", maxCount: 1 },
  { name: "class12thMarksPdf", maxCount: 1 },
  { name: "diplomaMarksPdf", maxCount: 1 },
  { name: "casteCertificate", maxCount: 1 },
  { name: "photo", maxCount: 1 },
  { name: "disabilityCertificate", maxCount: 1 },
  { name: "economicallyBackwardCertificate", maxCount: 1 },
  { name: "aadharCard", maxCount: 1 },
  { name: "transferCertificate", maxCount: 1 },
  { name: "studyCertificate", maxCount: 1 },
  { name: "embassyPermissionLetter", maxCount: 1 },
];
const router: Router = Router();

router.get(
  "/",
  validateRequest(GetAdmissionsQuerySchema, "query"),
  protect({
    role: ["admin", "admission"],
    permissions: {
      admission: ["read"],
    },
  }),
  AdmissionController.getAdmissions
);

// Endpoint to create the Admission Shell
router.post(
  "/shell",
  validateRequest(CreateAdmissionShellSchema),
  protect({
    role: ["admin", "admission"],
    permissions: {
      admission: ["create"],
      user: ["set-role"], // Needed to create the applicant user
    },
  }),
  AdmissionController.createShell
);

// Endpoint to get all admissions for a specific semester
router.get(
  "/semester/:semesterId",
  protect({
    role: ["admin", "admission"],
    permissions: {
      admission: ["read"],
    },
  }),
  AdmissionController.getBySemester
);

// Endpoint for applicant to fetch their own shell
router.get(
  "/me",
  protect({
    role: "applicant",
    permissions: { admission: ["read"] },
  }),
  AdmissionController.getMe
);

router.get(
  "/departments",
  protect({
    role: ["applicant", "admin", "admission"],
    permissions: { department: ["read"] },
  }),
  DepartmentController.getPublicDepartments
);

router.use(admissionUploadRouter);

// Endpoint for admin to delete an admission record (and its S3 files)
router.delete(
  "/:id",
  protect({
    role: ["admin", "admission"],
    permissions: {
      admission: ["delete"],
    },
  }),
  AdmissionController.deleteAdmission
);

router.patch(
  "/:id/approve",
  validateRequest(AdmissionActionParamSchema, "params"),
  protect({
    role: ["admin", "admission"],
    permissions: {
      admission: ["update"],
    },
  }),
  AdmissionController.approve
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
  AdmissionController.reject
);
router.patch(
  "/:id/cancel",
  validateRequest(AdmissionActionParamSchema, "params"),
  validateRequest(CancelAdmissionSchema),
  protect({
    role: ["admin", "admission"],
    permissions: {
      admission: ["update"],
    },
  }),
  AdmissionController.cancelAdmission
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
  AdmissionController.portStudents
);

// Endpoint for applicant to submit their final form
router.put(
  "/submit",
  protect({
    role: "applicant",
    permissions: { admission: ["update"] },
  }),
  upload.fields(applicationUploadFields),
  AdmissionController.submit
);

router.post(
  "/admission-submit",
  protect({
    role: ["admin", "admission"],
    permissions: { admission: ["create"] },
  }),
  upload.fields(applicationUploadFields),
  AdmissionController.staffSubmit
);

export default router;
