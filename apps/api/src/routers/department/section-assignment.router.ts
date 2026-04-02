import { SectionAssignmentController } from "@webcampus/api/src/controllers/department/section-assignment.controller";
import { SectionService } from "@webcampus/api/src/services/department/section.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { db } from "@webcampus/db";
import {
  CreateSectionAssignmentSchema,
  UpdateSectionAssignmentSchema,
} from "@webcampus/schemas/department";
import { NextFunction, Request, Response, Router } from "express";

const router: Router = Router();

const resolveRequestingUserId = async (req: Request): Promise<string> => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return session.user.id;
};

const paramAsString = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const guardSectionWriteAccessFromBody = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sectionId = req.body?.sectionId as string | undefined;
    if (!sectionId) {
      res
        .status(400)
        .json({ status: "error", message: "sectionId is required" });
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

const guardSectionWriteAccessFromAssignmentId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const assignmentId = paramAsString(req.params.id);
    if (!assignmentId) {
      res.status(400).json({ status: "error", message: "id is required" });
      return;
    }

    const assignment = await db.studentSection.findUnique({
      where: { id: assignmentId },
      select: { sectionId: true },
    });

    if (!assignment) {
      res
        .status(404)
        .json({ status: "error", message: "Section assignment not found" });
      return;
    }

    const requestingUserId = await resolveRequestingUserId(req);
    await SectionService.assertSectionWriteAccess(
      assignment.sectionId,
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

router.post(
  "/",
  protect({
    role: "department",
    permissions: {
      section: ["create"],
    },
  }),
  validateRequest(CreateSectionAssignmentSchema),
  guardSectionWriteAccessFromBody,
  SectionAssignmentController.create
);
router.get("/", SectionAssignmentController.getAll);
router.get("/:id", SectionAssignmentController.getById);
router.get("/section/:sectionId", SectionAssignmentController.getBySectionId);
router.put(
  "/:id",
  validateRequest(UpdateSectionAssignmentSchema),
  SectionAssignmentController.update
);
router.delete(
  "/:id",
  protect({
    role: "department",
    permissions: {
      section: ["delete"],
    },
  }),
  guardSectionWriteAccessFromAssignmentId,
  SectionAssignmentController.delete
);

export default router;
