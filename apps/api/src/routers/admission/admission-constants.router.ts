import { AdmissionConstantsController } from "@webcampus/api/src/controllers/admission/admission-constants.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  AdmissionReferenceCreateSchema,
  AdmissionReferenceListsSchema,
  AdmissionReferenceModeParamSchema,
} from "@webcampus/schemas/admission";
import { Router } from "express";

const router: Router = Router();

// Admission constants reference data (modes, quotas, categories) used for dropdowns
router.get(
  "/constants",
  protect({
    role: ["applicant", "admin", "admission", "admission-instructor"],
    permissions: { admission: ["read"] },
  }),
  AdmissionConstantsController.getAll
);

router.get(
  "/constants/options",
  protect({
    role: ["applicant", "admin", "admission", "admission-instructor"],
    permissions: { admission: ["read"] },
  }),
  AdmissionConstantsController.getOptions
);

// Management of admission reference data (modes, quotas, categories) by admin/admission
router.post(
  "/constants/modes",
  validateRequest(AdmissionReferenceCreateSchema),
  protect({
    role: ["admin", "admission"],
    permissions: { admission: ["create"] },
  }),
  AdmissionConstantsController.createMode
);

router.put(
  "/constants/modes/:mode",
  validateRequest(AdmissionReferenceModeParamSchema, "params"),
  validateRequest(AdmissionReferenceListsSchema),
  protect({
    role: ["admin", "admission"],
    permissions: { admission: ["update"] },
  }),
  AdmissionConstantsController.updateMode
);

router.delete(
  "/constants/modes/:mode",
  validateRequest(AdmissionReferenceModeParamSchema, "params"),
  protect({
    role: ["admin", "admission"],
    permissions: { admission: ["delete"] },
  }),
  AdmissionConstantsController.deleteMode
);

export default router;
