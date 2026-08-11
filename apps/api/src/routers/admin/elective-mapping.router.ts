import { ElectiveMappingController } from "@webcampus/api/src/controllers/department/elective-mapping.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  DeleteElectiveBatchSchema,
  ElectiveMappingListQuerySchema,
  OverridePeCourseSchema,
  RenameElectiveBatchSchema,
  SaveElectiveMappingSchema,
  ValidateElectiveMappingCsvSchema,
} from "@webcampus/schemas/department";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/",
  validateRequest(ElectiveMappingListQuerySchema, "query"),
  protect({
    role: "admin",
    permissions: { courses: ["read"] },
  }),
  ElectiveMappingController.list
);

router.get(
  "/:courseId",
  protect({
    role: "admin",
    permissions: { courses: ["read"] },
  }),
  ElectiveMappingController.detail
);

router.put(
  "/save",
  validateRequest(SaveElectiveMappingSchema),
  protect({
    role: "admin",
    permissions: { courses: ["update"] },
  }),
  ElectiveMappingController.save
);

router.post(
  "/validate-csv",
  validateRequest(ValidateElectiveMappingCsvSchema),
  protect({
    role: "admin",
    permissions: { courses: ["update"] },
  }),
  ElectiveMappingController.validateCsv
);

router.post(
  "/override-pe",
  validateRequest(OverridePeCourseSchema),
  protect({
    role: "admin",
    permissions: { courses: ["update"] },
  }),
  ElectiveMappingController.overridePe
);

router.post(
  "/rename-batch",
  validateRequest(RenameElectiveBatchSchema),
  protect({
    role: "admin",
    permissions: { courses: ["update"] },
  }),
  ElectiveMappingController.renameBatch
);

router.post(
  "/delete-batch",
  validateRequest(DeleteElectiveBatchSchema),
  protect({
    role: "admin",
    permissions: { courses: ["update"] },
  }),
  ElectiveMappingController.deleteBatch
);

export default router;
