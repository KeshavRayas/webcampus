import { SectionController } from "@webcampus/api/src/controllers/department/section.controller";
import { SectionService } from "@webcampus/api/src/services/department/section.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateSectionSchema,
  DetailedGenerationPreviewRequestSchema,
  GenerateCycleSectionsSchema,
  GenerateSectionsSchema,
  SectionQuerySchema,
} from "@webcampus/schemas/department";
import { NextFunction, Request, Response, Router } from "express";

const router = Router();

const resolveRequestingUserId = async (req: Request): Promise<string> => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return session.user.id;
};

const guardSemesterWriteAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const semesterId = req.body?.semesterId as string | undefined;

    if (!semesterId) {
      res.status(400).json({
        status: "error",
        message: "semesterId is required",
      });
      return;
    }

    const requestingUserId = await resolveRequestingUserId(req);
    await SectionService.assertSemesterWriteAccess(
      semesterId,
      requestingUserId
    );
    next();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unauthorized operation";
    res.status(message === "Unauthorized" ? 401 : 403).json({
      status: "error",
      message,
    });
  }
};

const guardSectionWriteAccessFromBody = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sectionId = req.body?.sectionId as string | undefined;
    if (!sectionId) {
      res.status(400).json({
        status: "error",
        message: "sectionId is required",
      });
      return;
    }

    const requestingUserId = await resolveRequestingUserId(req);
    await SectionService.assertSectionWriteAccess(sectionId, requestingUserId);
    next();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unauthorized operation";
    res.status(message === "Unauthorized" ? 401 : 403).json({
      status: "error",
      message,
    });
  }
};

const guardSectionWriteAccessFromParams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sectionId = req.params.id;
    if (!sectionId) {
      res.status(400).json({
        status: "error",
        message: "sectionId is required",
      });
      return;
    }

    const requestingUserId = await resolveRequestingUserId(req);
    await SectionService.assertSectionWriteAccess(sectionId, requestingUserId);
    next();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unauthorized operation";
    res.status(message === "Unauthorized" ? 401 : 403).json({
      status: "error",
      message,
    });
  }
};

router.post(
  "/",
  validateRequest(CreateSectionSchema),
  protect({
    role: "department",
    permissions: {
      section: ["create"],
    },
  }),
  guardSemesterWriteAccess,
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
  guardSemesterWriteAccess,
  SectionController.generateSections
);

router.post(
  "/preview-sections",
  validateRequest(DetailedGenerationPreviewRequestSchema),
  protect({
    role: "department",
    permissions: {
      section: ["read"],
    },
  }),
  guardSemesterWriteAccess,
  SectionController.getDetailedGenerationPreview
);

router.post(
  "/generate-cycle",
  validateRequest(GenerateCycleSectionsSchema),
  protect({
    role: "department",
    permissions: {
      section: ["create"],
    },
  }),
  guardSemesterWriteAccess,
  SectionController.generateCycleSections
);

router.get(
  "/department-info",
  protect({
    role: "department",
    permissions: {
      section: ["read"],
    },
  }),
  SectionController.getDepartmentInfo
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
  "/unassigned-counts",
  protect({
    role: "department",
    permissions: {
      section: ["read"],
    },
  }),
  SectionController.getUnassignedStudentCounts
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
  guardSectionWriteAccessFromBody,
  SectionController.assignStudentsToSection
);

router.get("/:id", SectionController.getById);

router.delete(
  "/:id",
  protect({
    role: "department",
    permissions: {
      section: ["delete"],
    },
  }),
  guardSectionWriteAccessFromParams,
  SectionController.delete
);

export default router;
