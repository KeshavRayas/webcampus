import { AccountsController } from "@webcampus/api/src/controllers/accounts/accounts.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  AccountsStudentSearchQuerySchema,
  AddAccountsPaymentSchema,
  UpsertAccountsSchema,
} from "@webcampus/schemas/accounts";
import { Router } from "express";

const router: Router = Router();

router.use(protect({ role: "accounts", permissions: { accounts: ["read"] } }));
router.get(
  "/students",
  validateRequest(AccountsStudentSearchQuerySchema, "query"),
  AccountsController.search
);
router.get("/students/:studentId", AccountsController.getStudent);
router.put(
  "/students/:studentId/fee",
  protect({ role: "accounts", permissions: { accounts: ["update"] } }),
  validateRequest(UpsertAccountsSchema),
  AccountsController.saveFee
);
router.post(
  "/:accountsId/payments",
  protect({ role: "accounts", permissions: { accounts: ["update"] } }),
  validateRequest(AddAccountsPaymentSchema),
  AccountsController.addPayment
);

export default router;
