import {
  getCourseOutcomes,
  updateCourseOutcomes,
} from "@webcampus/api/src/controllers/faculty/course-outcome.controller";
import { Router } from "express";

const router: Router = Router();

router.get("/", getCourseOutcomes);
router.post("/", updateCourseOutcomes);

export default router;
