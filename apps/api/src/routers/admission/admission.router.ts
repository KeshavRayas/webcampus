import { AdmissionController } from "@webcampus/api/src/controllers/admission/admission.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateAdmissionShellSchema,
  GetAdmissionsQuerySchema,
} from "@webcampus/schemas/admission";
import { Router } from "express";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.get(
  "/",
  validateRequest(GetAdmissionsQuerySchema, "query"),
  protect({
    role: "admin",
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
    role: "admin",
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
    role: "admin",
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

// Endpoint for admin to delete an admission record (and its S3 files)
router.delete(
  "/:id",
  protect({
    role: "admin",
    permissions: {
      admission: ["delete"],
    },
  }),
  AdmissionController.deleteAdmission
);

// Endpoint for applicant to submit their final form
router.put(
  "/submit",
  protect({
    role: "applicant",
    permissions: { admission: ["update"] },
  }),
  upload.fields([
    { name: "class10thMarksPdf", maxCount: 1 },
    { name: "class12thMarksPdf", maxCount: 1 },
    { name: "casteCertificate", maxCount: 1 },
    { name: "photo", maxCount: 1 },
    { name: "disabilityCertificate", maxCount: 1 },
    { name: "economicallyBackwardCertificate", maxCount: 1 },
    { name: "aadharCard", maxCount: 1 },
    { name: "transferCertificate", maxCount: 1 },
    { name: "studyCertificate", maxCount: 1 },
  ]),
  AdmissionController.submit
);

export default router;
