import { CoeController } from "@webcampus/api/src/controllers/admin/coe.controller";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";

const router: Router = Router();

router.use(
  protect({
    role: "admin",
    permissions: {
      user: ["set-role", "get"],
    },
  })
);

router.post("/", CoeController.createCoe);
router.get("/", CoeController.getCoes);
router.delete("/:id", CoeController.deleteCoe);

export default router;
