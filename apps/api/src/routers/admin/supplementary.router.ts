import { SupplementaryController } from "@webcampus/api/src/controllers/admin/supplementary.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  AssignSupplementaryStudentsSchema,
  CreateSupplementaryOfferingSchema,
  CreateSupplementarySectionSchema,
  GetSupplementaryRegistrationsQuerySchema,
  SupplementaryOfferingParamsSchema,
  SupplementarySectionParamsSchema,
  SupplementaryTermParamsSchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";

const router: Router = Router();

router.use(
  protect({ role: "admin", permissions: { supplementary: ["read"] } })
);

router.get(
  "/terms/:academicTermId/offerings",
  validateRequest(SupplementaryTermParamsSchema, "params"),
  SupplementaryController.getOfferings
);

router.get(
  "/terms/:academicTermId/demand",
  validateRequest(SupplementaryTermParamsSchema, "params"),
  SupplementaryController.getDemandReport
);

router.post(
  "/offerings",
  protect({ role: "admin", permissions: { supplementary: ["create"] } }),
  validateRequest(CreateSupplementaryOfferingSchema),
  SupplementaryController.addOffering
);

router.delete(
  "/offerings/:id",
  protect({ role: "admin", permissions: { supplementary: ["delete"] } }),
  validateRequest(SupplementaryOfferingParamsSchema, "params"),
  SupplementaryController.removeOffering
);

router.get(
  "/registrations",
  validateRequest(GetSupplementaryRegistrationsQuerySchema, "query"),
  SupplementaryController.getRegistrations
);

router.post(
  "/offerings/:id/sections",
  protect({ role: "admin", permissions: { supplementary: ["create"] } }),
  validateRequest(SupplementaryOfferingParamsSchema, "params"),
  validateRequest(CreateSupplementarySectionSchema),
  SupplementaryController.createSection
);

router.get(
  "/offerings/:id/sections",
  validateRequest(SupplementaryOfferingParamsSchema, "params"),
  SupplementaryController.getSections
);

router.post(
  "/sections/:id/students",
  protect({ role: "admin", permissions: { supplementary: ["create"] } }),
  validateRequest(SupplementarySectionParamsSchema, "params"),
  validateRequest(AssignSupplementaryStudentsSchema),
  SupplementaryController.assignStudents
);

export default router;
