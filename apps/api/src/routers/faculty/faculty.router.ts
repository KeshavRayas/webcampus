import { FacultyController } from "@webcampus/api/src/controllers/faculty/faculty.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateFacultyExperienceSchema,
  CreateFacultyPublicationSchema,
  CreateFacultyQualificationSchema,
  UpdateFacultyExperienceSchema,
  UpdateFacultyProfileSchema,
  UpdateFacultyPublicationSchema,
  UpdateFacultyQualificationSchema,
} from "@webcampus/schemas/faculty";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

router.use(
  protect({
    role: ["faculty", "admin"],
    permissions: {},
  })
);

router.get("/", FacultyController.getMyProfile);
router.put("/", validateRequest(UpdateFacultyProfileSchema), FacultyController.updateMyProfile);

router.post(
  "/qualifications",
  validateRequest(CreateFacultyQualificationSchema),
  FacultyController.createQualification
);
router.put(
  "/qualifications/:id",
  validateRequest(UpdateFacultyQualificationSchema),
  FacultyController.updateQualification
);
router.delete("/qualifications/:id", FacultyController.deleteQualification);

router.post(
  "/publications",
  validateRequest(CreateFacultyPublicationSchema),
  FacultyController.createPublication
);
router.put(
  "/publications/:id",
  validateRequest(UpdateFacultyPublicationSchema),
  FacultyController.updatePublication
);
router.delete("/publications/:id", FacultyController.deletePublication);

router.post(
  "/experiences",
  validateRequest(CreateFacultyExperienceSchema),
  FacultyController.createExperience
);
router.put(
  "/experiences/:id",
  validateRequest(UpdateFacultyExperienceSchema),
  FacultyController.updateExperience
);
router.delete("/experiences/:id", FacultyController.deleteExperience);

export default router;
