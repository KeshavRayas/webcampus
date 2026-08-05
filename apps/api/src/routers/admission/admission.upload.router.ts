import { AdmissionUploadController } from "@webcampus/api/src/controllers/admission/admission.upload.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { AdmissionActionParamSchema } from "@webcampus/schemas/admission";
import { Router } from "express";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 9,
  },
  fileFilter: (_req, file, callback) => {
    const allowedMimeTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
    ]);

    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Only PDF, JPG, JPEG, and PNG files are allowed"));
      return;
    }

    callback(null, true);
  },
});

const router: Router = Router();

router.patch(
  "/:id/documents",
  validateRequest(AdmissionActionParamSchema, "params"),
  protect({
    role: ["admin", "admission"],
    permissions: {
      admission: ["update"],
    },
  }),
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "aadharCard", maxCount: 1 },
    { name: "class10thMarksPdf", maxCount: 1 },
    { name: "class12thMarksPdf", maxCount: 1 },
    { name: "diplomaMarksPdf", maxCount: 1 },
    { name: "casteCertificate", maxCount: 1 },
    { name: "disabilityCertificate", maxCount: 1 },
    { name: "studyCertificate", maxCount: 1 },
    { name: "transferCertificate", maxCount: 1 },
  ]),
  AdmissionUploadController.uploadDocuments
);

export default router;
