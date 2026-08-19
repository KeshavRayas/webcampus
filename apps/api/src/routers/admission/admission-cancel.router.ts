import { AdmissionCancelController } from "@webcampus/api/src/controllers/admission/admission-cancel.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  AdmissionActionParamSchema,
  CancelAdmissionSchema,
} from "@webcampus/schemas/admission";
import { Router } from "express";

const router: Router = Router();

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
  AdmissionCancelController.cancelAdmission
);

export default router;
