import { SectionController } from "@webcampus/api/src/controllers/department/section.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateSectionSchema,
  GenerateSectionsSchema,
  SectionQuerySchema,
} from "@webcampus/schemas/department";
import { Router } from "express";

const router = Router();

router.post(
  "/",
  validateRequest(CreateSectionSchema),
  protect({
    role: "department",
    permissions: {
      section: ["create"],
    },
  }),
  SectionController.create
);

router.post(
  "/generate",
  validateRequest(GenerateSectionsSchema),
  protect({
    role: "department",
    permissions: {
      section: ["create"],
    },
  }),
  SectionController.generateSections
);

router.get(
  "/",
  validateRequest(SectionQuerySchema, "query"),
  protect({
    role: "department",
    permissions: {
      section: ["read"],
    },
  }),
  SectionController.getAll
);

router.get(
  "/unassigned-count",
  protect({
    role: "department",
    permissions: {
      section: ["read"],
    },
  }),
  SectionController.getUnassignedCount
);

router.get(
  "/with-students",
  protect({
    role: "department",
    permissions: {
      section: ["read"],
    },
  }),
  SectionController.getSectionsWithStudents
);

router.get(
  "/unassigned-students",
  protect({
    role: "department",
    permissions: {
      section: ["read"],
    },
  }),
  SectionController.getUnassignedStudents
);

router.post(
  "/assign-students",
  protect({
    role: "department",
    permissions: {
      section: ["create"],
    },
  }),
  SectionController.assignStudentsToSection
);

router.get("/:id", SectionController.getById);

router.delete("/:id", SectionController.delete);

export default router;
