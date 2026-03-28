import { SemesterController } from "@webcampus/api/src/controllers/admin/semester.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  AcademicTermQuerySchema,
  CreateAcademicTermSchema,
  CreateSemesterConfigSchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";
import { z } from "zod";

const router = Router();

router.post(
  "/",
  validateRequest(CreateAcademicTermSchema),
  protect({
    role: "admin",
    permissions: {
      semester: ["create"],
    },
  }),
  SemesterController.createAcademicTerm
);

router.put(
  "/:id",
  validateRequest(CreateAcademicTermSchema),
  protect({
    role: "admin",
    permissions: {
      semester: ["update"],
    },
  }),
  SemesterController.updateAcademicTerm
);

router.delete(
  "/:id",
  protect({
    role: "admin",
    permissions: { semester: ["delete"] },
  }),
  SemesterController.deleteAcademicTerm
);

router.get(
  "/",
  validateRequest(AcademicTermQuerySchema, "query"),
  protect({
    permissions: { semester: ["read"] },
  }),
  SemesterController.getAllAcademicTerms
);

router.put(
  "/:id/semesters",
  validateRequest(z.array(CreateSemesterConfigSchema)),
  protect({
    role: "admin",
    permissions: { semester: ["update"] },
  }),
  SemesterController.bulkUpsertSemesters
);

router.get(
  "/:id/semesters",
  protect({
    permissions: { semester: ["read"] },
  }),
  SemesterController.getSemestersByTerm
);

export default router;
