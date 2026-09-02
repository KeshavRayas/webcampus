import { AdmissionCreateController } from "@webcampus/api/src/controllers/admission/admission-create.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateAdmissionShellSchema,
  SubmitApplicationSchema,
} from "@webcampus/schemas/admission";
import { Router } from "express";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

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

// Endpoint to create the Admission Shell
router.post(
  "/shell",
  validateRequest(CreateAdmissionShellSchema),
  protect({
    role: ["admin", "admission", "admission-instructor"],
    permissions: {
      admission: ["create"],
      user: ["set-role"], // Needed to create the applicant user
    },
  }),
  AdmissionCreateController.createShell
);

// Endpoint for applicant to fetch their own shell
router.get(
  "/me",
  protect({
    role: "applicant",
    permissions: { admission: ["read"] },
  }),
  AdmissionCreateController.getMe
);

// Endpoint for applicant to submit their final form
router.put(
  "/submit",
  protect({
    role: "applicant",
    permissions: { admission: ["update"] },
  }),
  upload.fields(applicationUploadFields),
  validateRequest(SubmitApplicationSchema),
  AdmissionCreateController.submit
);

router.post(
  "/admission-submit",
  protect({
    role: ["admin", "admission", "admission-instructor"],
    permissions: { admission: ["create"] },
  }),
  upload.fields(applicationUploadFields),
  validateRequest(SubmitApplicationSchema),
  AdmissionCreateController.staffSubmit
);

export default router;
