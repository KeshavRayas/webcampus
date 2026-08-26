import {
  createProgrammeOutcome,
  deleteProgrammeOutcome,
  getProgrammeOutcomes,
  updateProgrammeOutcome,
} from "@webcampus/api/src/controllers/admin/programme-outcome.controller";
import { Router } from "express";

const router: Router = Router();

router.get("/", getProgrammeOutcomes);
router.post("/", createProgrammeOutcome);
router.put("/:id", updateProgrammeOutcome);
router.delete("/:id", deleteProgrammeOutcome);

export default router;
