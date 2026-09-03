import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";
import {
  getDepartmentCourses,
  getDepartmentSections,
} from "../../controllers/hod/hod-courses.controller";

const router: Router = Router();

router.get(
  "/",
  protect({ role: "hod", permissions: {} }),
  getDepartmentCourses
);
router.get(
  "/sections",
  protect({ role: "hod", permissions: {} }),
  getDepartmentSections
);

export default router;
