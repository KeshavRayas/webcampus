import { Router } from "express";
import {
  getDepartmentFaculty,
  getFacultyProfile,
} from "../../controllers/hod/hod-faculty.controller";

const router: Router = Router();

router.get("/", getDepartmentFaculty);
router.get("/:id", getFacultyProfile);

export default router;
