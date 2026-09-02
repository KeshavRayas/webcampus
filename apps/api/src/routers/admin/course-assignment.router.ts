import { AdminCourseAssignmentController } from "@webcampus/api/src/controllers/admin/course-assignment.controller";
import { upload } from "@webcampus/api/src/utils/upload";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  AdminCourseMappingByCourseQuerySchema,
  AdminCourseMappingFacultyQuerySchema,
  AdminCourseMappingSectionsQuerySchema,
  AdminCourseMappingStatusQuerySchema,
  AdminDeleteCourseMappingSchema,
  AdminDownloadMappingTemplateQuerySchema,
  AdminUpsertCourseMappingSchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/status",
  validateRequest(AdminCourseMappingStatusQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: {
      courseAssignment: ["read"],
    },
  }),
  AdminCourseAssignmentController.getMappingStatus
);

router.get(
  "/by-course",
  validateRequest(AdminCourseMappingByCourseQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: {
      courseAssignment: ["read"],
    },
  }),
  AdminCourseAssignmentController.getMappingByCourse
);

router.post(
  "/upsert",
  validateRequest(AdminUpsertCourseMappingSchema),
  protect({
    role: "admin",
    permissions: {
      courseAssignment: ["create"],
    },
  }),
  AdminCourseAssignmentController.upsertMapping
);

router.put(
  "/upsert",
  validateRequest(AdminUpsertCourseMappingSchema),
  protect({
    role: "admin",
    permissions: {
      courseAssignment: ["create"],
    },
  }),
  AdminCourseAssignmentController.upsertMapping
);

router.delete(
  "/",
  validateRequest(AdminDeleteCourseMappingSchema),
  protect({
    role: "admin",
    permissions: {
      courseAssignment: ["create"],
    },
  }),
  AdminCourseAssignmentController.deleteMappings
);

router.get(
  "/faculty",
  validateRequest(AdminCourseMappingFacultyQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: {
      faculty: ["read"],
    },
  }),
  AdminCourseAssignmentController.getFacultyForMapping
);

router.get(
  "/sections",
  validateRequest(AdminCourseMappingSectionsQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: {
      section: ["read"],
    },
  }),
  AdminCourseAssignmentController.getSectionsForMapping
);

router.get(
  "/excel/template",
  validateRequest(AdminDownloadMappingTemplateQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: { courseAssignment: ["read"] },
  }),
  AdminCourseAssignmentController.downloadTemplate
);

router.post(
  "/excel/upload",
  protect({
    role: "admin",
    permissions: { courseAssignment: ["create"] },
  }),
  upload.single("file"), // Multer grabs the file from form-data and puts it in req.file
  AdminCourseAssignmentController.uploadTemplate
);

export default router;
