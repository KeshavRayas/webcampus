import { AdminTrustController } from "@webcampus/api/src/controllers/admin/trust.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateTrustUserSchema,
  UpdateTrustUserSchema,
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
  validateRequest(CreateTrustUserSchema.omit({ role: true })),
  AdminTrustController.create
);

router.put(
  "/:id",
  upload.single("photo"),
  validateRequest(UpdateTrustUserSchema),
  AdminTrustController.update
);

router.patch(
  "/:id",
  upload.single("photo"),
  validateRequest(UpdateTrustUserSchema),
  AdminTrustController.update
);

router.get("/", AdminTrustController.getAll);

router.delete("/:id", AdminTrustController.delete);

export default router;
