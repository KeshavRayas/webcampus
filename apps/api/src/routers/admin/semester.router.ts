import { SemesterController } from "@webcampus/api/src/controllers/admin/semester.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { CreateSemesterSchema } from "@webcampus/schemas/admin";
import { Router } from "express";

const router = Router();

router.post(
  "/",
  validateRequest(CreateSemesterSchema),
  protect({
    role: "admin",
    permissions: {
      semester: ["create"],
    },
  }),
  SemesterController.create
);

router.put(
  "/:id",
  validateRequest(CreateSemesterSchema),
  protect({
    role: "admin",
    permissions: {
      semester: ["update"],
    },
  }),
  SemesterController.update
);

router.delete(
  "/:id",
  protect({
    role: "admin",
    permissions: { semester: ["delete"] },
  }),
  SemesterController.delete
);

router.get(
  "/",
  protect({
    permissions: { semester: ["read"] },
  }),
  SemesterController.getAll
);

export default router;
