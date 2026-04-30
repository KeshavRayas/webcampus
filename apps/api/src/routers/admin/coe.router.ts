import { CoeController } from "@webcampus/api/src/controllers/admin/coe.controller";
import { protect } from "@webcampus/backend-utils/middlewares";
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

// Added upload.single("photo") to match the frontend key
router.post("/", upload.single("photo"), CoeController.createCoe);
router.get("/", CoeController.getCoes);

// NEW: Added Patch route for editing COE users
router.patch("/:id", upload.single("photo"), CoeController.updateCoe);

router.delete("/:id", CoeController.deleteCoe);

export default router;
