import { SemesterController } from "@webcampus/api/src/controllers/admin/semester.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  AcademicTermQuerySchema,
  CreateAcademicTermSchema,
  CreateSemesterConfigSchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";

const router: Router = Router();

router.post(
  "/",
  protect({
    role: "admin",
    permissions: {
      semester: ["create"],
    },
  }),
  validateRequest(CreateAcademicTermSchema),
  SemesterController.createAcademicTerm
);

router.put(
  "/:id",
  protect({
    role: "admin",
    permissions: {
      semester: ["update"],
    },
  }),
  validateRequest(CreateAcademicTermSchema),
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
  protect({
    permissions: { semester: ["read"] },
  }),
  validateRequest(AcademicTermQuerySchema, "query"),
  SemesterController.getAllAcademicTerms
);

router.put(
  "/:id/semesters",
  protect({
    role: "admin",
    permissions: { semester: ["update"] },
  }),
  validateRequest(CreateSemesterConfigSchema.array()),
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
