import { CoeController } from "@webcampus/api/src/controllers/admin/coe.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  createUserSchema,
  UpdateAdminUserSchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";
import multer from "multer";

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(
  protect({
    role: "admin",
    permissions: {
      user: ["set-role", "get"],
    },
  })
);

router.post(
  "/",
  upload.single("photo"),
  validateRequest(createUserSchema.omit({ role: true })),
  CoeController.createCoe
);
router.put(
  "/:id",
  upload.single("photo"),
  validateRequest(UpdateAdminUserSchema),
  CoeController.updateCoe
);
router.get("/", CoeController.getCoes);

router.patch("/:id", upload.single("photo"), CoeController.updateCoe);

router.delete("/:id", CoeController.deleteCoe);

export default router;
