import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";
import {
  getFinalLockedData,
  getFrozenData,
} from "../../controllers/coe/coe.controller";

const router: Router = Router();

router.get(
  "/frozen-data",
  protect({ role: "coe", permissions: {} }),
  getFrozenData
);
router.get(
  "/final-locked",
  protect({ role: "coe", permissions: {} }),
  getFinalLockedData
);

export default router;
