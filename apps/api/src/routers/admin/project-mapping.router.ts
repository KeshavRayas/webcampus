import { ProjectMappingController } from "@webcampus/api/src/controllers/department/project-mapping.controller";
import { upload } from "@webcampus/api/src/utils/upload";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  ProjectMappingBulkAssignSchema,
  ProjectMappingCourseParamsSchema,
  ProjectMappingGroupParamsSchema,
  ProjectMappingGroupsQuerySchema,
  ProjectMappingListQuerySchema,
  ProjectMappingSaveFacultySchema,
  ProjectMappingSaveSchema,
} from "@webcampus/schemas/department";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/",
  validateRequest(ProjectMappingListQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: { courses: ["read"] },
  }),
  ProjectMappingController.list
);

router.get(
  "/:courseId",
  protect({
    role: "admin",
    permissions: { courses: ["read"] },
  }),
  ProjectMappingController.detail
);

router.get(
  "/:courseId/groups",
  validateRequest(ProjectMappingCourseParamsSchema, "params"),
  validateRequest(ProjectMappingGroupsQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: { courses: ["read"] },
  }),
  ProjectMappingController.getGroups
);

router.get(
  "/:courseId/groups/:groupId",
  validateRequest(ProjectMappingGroupParamsSchema, "params"),
  protect({
    role: "admin",
    permissions: { courses: ["read"] },
  }),
  ProjectMappingController.getGroupDetail
);

router.get(
  "/:courseId/excel/template",
  validateRequest(ProjectMappingCourseParamsSchema, "params"),
  protect({
    role: "admin",
    permissions: { courses: ["read"] },
  }),
  ProjectMappingController.downloadTemplate
);

router.post(
  "/:courseId/excel/validate",
  protect({
    role: "admin",
    permissions: { courses: ["update"] },
  }),
  upload.single("file"),
  ProjectMappingController.validateUpload
);

router.put(
  "/save",
  validateRequest(ProjectMappingSaveSchema),
  protect({
    role: "admin",
    permissions: { courses: ["update"] },
  }),
  ProjectMappingController.saveAssignments
);

router.put(
  "/save-full",
  validateRequest(ProjectMappingSaveSchema),
  protect({
    role: "admin",
    permissions: { courses: ["update"] },
  }),
  ProjectMappingController.saveFullMapping
);

router.post(
  "/save-faculty",
  validateRequest(ProjectMappingSaveFacultySchema),
  protect({
    role: "admin",
    permissions: { courses: ["update"] },
  }),
  ProjectMappingController.saveFaculty
);

router.post(
  "/bulk-assign",
  validateRequest(ProjectMappingBulkAssignSchema),
  protect({
    role: "admin",
    permissions: { courses: ["update"] },
  }),
  ProjectMappingController.bulkAssign
);

export default router;
