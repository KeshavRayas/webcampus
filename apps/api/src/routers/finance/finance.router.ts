import { FinanceController } from "@webcampus/api/src/controllers/finance/finance.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  AddFinancePaymentSchema,
  FinanceStudentSearchQuerySchema,
  UpsertFinanceSchema,
} from "@webcampus/schemas/finance";
import { Router } from "express";

const router: Router = Router();

router.use(protect({ role: "finance", permissions: { finance: ["read"] } }));
router.get(
  "/students",
  validateRequest(FinanceStudentSearchQuerySchema, "query"),
  FinanceController.search
);
router.get("/students/:studentId", FinanceController.getStudent);
router.put(
  "/students/:studentId/fee",
  protect({ role: "finance", permissions: { finance: ["update"] } }),
  validateRequest(UpsertFinanceSchema),
  FinanceController.saveFee
);
router.post(
  "/:financeId/payments",
  protect({ role: "finance", permissions: { finance: ["update"] } }),
  validateRequest(AddFinancePaymentSchema),
  FinanceController.addPayment
);

export default router;
