import { AdmissionFeeController } from "@webcampus/api/src/controllers/admission/admission-fee.controller";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";

const router: Router = Router();

// Fee structure lookup used to surface an uneditable Fees value on the Pay Now dialog
router.get(
  "/fee-structure",
  protect({
    role: ["admin", "admission"],
    permissions: { admission: ["read"] },
  }),
  AdmissionFeeController.getFeeStructure
);

export default router;
