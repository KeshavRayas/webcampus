import { AdminAccountsController } from "@webcampus/api/src/controllers/admin/accounts.controller";
import { upload } from "@webcampus/api/src/utils/upload";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateAccountsUserSchema,
  UpdateAccountsUserSchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";

const router: Router = Router();

router.use(
  protect({
    role: "admin",
    permissions: { user: ["set-role", "get", "delete"] },
  })
);

router.post(
  "/",
  upload.single("photo"),
  validateRequest(CreateAccountsUserSchema.omit({ role: true })),
  AdminAccountsController.create
);

router.put(
  "/:id",
  upload.single("photo"),
  validateRequest(UpdateAccountsUserSchema),
  AdminAccountsController.update
);

router.patch(
  "/:id",
  upload.single("photo"),
  validateRequest(UpdateAccountsUserSchema),
  AdminAccountsController.update
);

router.get("/", AdminAccountsController.getAll);

router.delete("/:id", AdminAccountsController.delete);

export default router;
