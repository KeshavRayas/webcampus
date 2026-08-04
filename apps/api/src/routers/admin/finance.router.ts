import { AdminFinanceController } from "@webcampus/api/src/controllers/admin/finance.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateFinanceUserSchema,
  UpdateFinanceUserSchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";
import multer from "multer";

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(
  protect({
    role: "admin",
    permissions: { user: ["set-role", "get", "delete"] },
  })
);

router.post(
  "/",
  upload.single("photo"),
  validateRequest(CreateFinanceUserSchema.omit({ role: true })),
  AdminFinanceController.create
);

router.put(
  "/:id",
  upload.single("photo"),
  validateRequest(UpdateFinanceUserSchema),
  AdminFinanceController.update
);

router.patch(
  "/:id",
  upload.single("photo"),
  validateRequest(UpdateFinanceUserSchema),
  AdminFinanceController.update
);

router.get("/", AdminFinanceController.getAll);

router.delete("/:id", AdminFinanceController.delete);

export default router;
