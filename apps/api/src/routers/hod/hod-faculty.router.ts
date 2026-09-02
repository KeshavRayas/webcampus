import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";
import {
  getDepartmentFaculty,
  getFacultyProfile,
} from "../../controllers/hod/hod-faculty.controller";

const router: Router = Router();

router.get(
  "/",
  protect({ role: "hod", permissions: {} }),
  getDepartmentFaculty
);
router.get(
  "/:id",
  protect({ role: "hod", permissions: {} }),
  getFacultyProfile
);

export default router;
