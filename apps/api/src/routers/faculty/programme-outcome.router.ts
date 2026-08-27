import { getProgrammeOutcomesForCourse } from "@webcampus/api/src/controllers/faculty/programme-outcome.controller";
import { Router } from "express";

const router: Router = Router();

router.get("/", getProgrammeOutcomesForCourse);

export default router;
