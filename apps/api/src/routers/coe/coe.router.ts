import { Router } from "express";
import {
  getFinalLockedData,
  getFrozenData,
} from "../../controllers/coe/coe.controller";

const router: Router = Router();

router.get("/frozen-data", getFrozenData);
router.get("/final-locked", getFinalLockedData);

export default router;
