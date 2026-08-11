import { Router } from "express";
import {
  getDepartmentCourses,
  getDepartmentSections,
} from "../../controllers/hod/hod-courses.controller";

const router: Router = Router();

router.get("/", getDepartmentCourses);
router.get("/sections", getDepartmentSections);

export default router;
