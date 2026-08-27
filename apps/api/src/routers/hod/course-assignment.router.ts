import { CourseAssignmentController } from "@webcampus/api/src/controllers/hod/course-assignment.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { CreateCourseAssignmentSchema } from "@webcampus/schemas/hod";
import { Router } from "express";

const router: Router = Router();

router.post(
  "/",
  protect({ role: "hod", permissions: {} }),
  validateRequest(CreateCourseAssignmentSchema),
  CourseAssignmentController.create
);
router.get(
  "/",
  protect({ role: "hod", permissions: {} }),
  CourseAssignmentController.getAll
);
router.get(
  "/:id",
  protect({ role: "hod", permissions: {} }),
  CourseAssignmentController.getById
);
router.get(
  "/faculty/:facultyId",
  protect({ role: "hod", permissions: {} }),
  CourseAssignmentController.getByFacultyId
);
router.delete(
  "/:id",
  protect({ role: "hod", permissions: {} }),
  CourseAssignmentController.delete
);

export default router;
