import { CourseController } from "@webcampus/api/src/controllers/department/course.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  ApproveSemesterCoursesSchema,
  CourseBranchQuerySchema,
  CreateCourseSchema,
  DeleteCourseSchema,
  RequestRevisionForSemesterSchema,
  UpdateCoordinatorsBodySchema,
  UpdateCourseSchema,
} from "@webcampus/schemas/department";
import { Router } from "express";

const router: Router = Router();

router.post(
  "/",
  validateRequest(CreateCourseSchema),
  protect({
    role: "department",
    permissions: {
      courses: ["create"],
    },
  }),
  CourseController.create
);

router.put(
  "/",
  validateRequest(UpdateCourseSchema),
  protect({
    role: "department",
    permissions: {
      courses: ["update"],
    },
  }),
  CourseController.update
);

router.delete(
  "/",
  validateRequest(DeleteCourseSchema),
  protect({
    role: "department",
    permissions: {
      courses: ["delete"],
    },
  }),
  CourseController.delete
);

router.get(
  "/branch",
  validateRequest(CourseBranchQuerySchema, "query"),
  protect({
    role: "department",
    permissions: {
      courses: ["read"],
    },
  }),
  CourseController.getByBranch
);

router.post(
  "/bulk-submit",
  protect({
    role: "department",
    permissions: {
      courses: ["update"],
    },
  }),
  CourseController.bulkSubmitForApproval
);

router.get(
  "/pending-submissions",
  protect({
    role: ["admin", "coe"],
    permissions: {},
  }),
  CourseController.getGroupedCourseSubmissions
);

router.get(
  "/:id/coordinators",
  protect({
    role: "department",
    permissions: {
      courseCoordinator: ["read"],
    },
  }),
  CourseController.getCoordinators
);

router.put(
  "/:id/coordinators",
  validateRequest(UpdateCoordinatorsBodySchema),
  protect({
    role: "department",
    permissions: {
      courseCoordinator: ["update"],
    },
  }),
  CourseController.updateCoordinators
);

router.get(
  "/:id/mapped-faculty",
  protect({
    role: "department",
    permissions: {
      courseCoordinator: ["read"],
    },
  }),
  CourseController.getMappedFaculty
);

router.get(
  "/:id",
  protect({
    role: "department",
    permissions: {
      courses: ["read"],
    },
  }),
  CourseController.getById
);

router.post(
  "/approve",
  validateRequest(ApproveSemesterCoursesSchema),
  protect({
    role: ["admin", "coe"],
    permissions: {},
  }),
  CourseController.approveSemesterCourses
);

router.post(
  "/request-revision",
  validateRequest(RequestRevisionForSemesterSchema),
  protect({
    role: ["admin", "coe"],
    permissions: {},
  }),
  CourseController.requestRevisionForSemester
);

export default router;
