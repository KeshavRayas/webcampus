import { TimetableService } from "@webcampus/api/src/services/timetable/timetable.service";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Request, Response, Router } from "express";
import type { Router as ExpressRouter } from "express";
import { z } from "zod";

const router: ExpressRouter = Router();
const params = (req: Request) =>
  req.params as Record<string, string | undefined>;
const context = (req: Request) => req.requestContext;

// Validation schemas
const createTimetableSchema = z.object({
  academicYear: z.string(),
  semesterId: z.string(),
  departmentId: z.string().optional(),
  courseId: z.string(),
  facultyId: z.string(),
  roomNumber: z.string(),
  dayOfWeek: z.enum([
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ]),
  startTime: z.string(),
  endTime: z.string(),
  classType: z.enum(["LECTURE", "LAB", "TUTORIAL", "SEMINAR", "OTHER"]),
  sectionId: z.string().optional(),
  batchId: z.string().optional(),
});

const updateTimetableSchema = createTimetableSchema.partial();

router.get(
  "/today/:semesterId",
  protect({ role: "student" as const, permissions: {} }),
  async (req: Request, res: Response) => {
    try {
      const semesterId = params(req).semesterId!;
      const facultyId = (context(req) as { facultyId?: string } | undefined)
        ?.facultyId;
      const entries = await TimetableService.getTodayEntries(
        semesterId,
        facultyId
      );
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch today's timetable",
      });
    }
  }
);

router.get(
  "/weekly/:semesterId",
  protect({ role: "student" as const, permissions: {} }),
  async (req: Request, res: Response) => {
    try {
      const semesterId = params(req).semesterId!;
      const entries = await TimetableService.getEntriesBySemester(semesterId);
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch weekly timetable",
      });
    }
  }
);

router.get(
  "/download/:semesterId",
  protect({ role: "student" as const, permissions: {} }),
  async (req: Request, res: Response) => {
    try {
      const semesterId = params(req).semesterId!;
      const entries = await TimetableService.getEntriesBySemester(semesterId);
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch today's timetable",
      });
    }
  }
);

router.get(
  "/download/:semesterId/:sectionId",
  protect({ role: "student" as const, permissions: {} }),
  async (req: Request, res: Response) => {
    try {
      const semesterId = params(req).semesterId!;
      const sectionId = params(req).sectionId!;
      const entries = await TimetableService.getEntriesBySemester(
        semesterId,
        undefined,
        sectionId
      );
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to download timetable",
      });
    }
  }
);

// Faculty today's classes
router.get(
  "/faculty/today/:semesterId",
  protect({ role: "faculty" as const, permissions: {} }),
  async (req: Request, res: Response) => {
    try {
      const semesterId = params(req).semesterId!;
      const entries = await TimetableService.getTodayEntries(semesterId);
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch today's classes",
      });
    }
  }
);

// Faculty weekly teaching timetable
router.get(
  "/faculty/weekly/:semesterId",
  protect({ role: "faculty" as const, permissions: {} }),
  async (req: Request, res: Response) => {
    try {
      const semesterId = params(req).semesterId!;
      const facultyId = (context(req) as { facultyId?: string } | undefined)
        ?.facultyId;
      if (!facultyId) {
        res
          .status(403)
          .json({ status: "error", message: "Faculty profile not found" });
        return;
      }
      const entries = await TimetableService.getEntriesByFaculty(
        facultyId,
        semesterId
      );
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch weekly teaching timetable",
      });
    }
  }
);

// Department Admin: Create timetable entry
router.post(
  "/",
  protect({ role: "department" as const, permissions: {} }),
  async (req: Request, res: Response) => {
    try {
      const parsed = createTimetableSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          message: "Invalid input data",
        });
        return;
      }

      // Get userId from the session - the protect middleware sets req.requestContext
      const userId = context(req)?.userId || "system";
      const entry = await TimetableService.createEntry(parsed.data, userId);
      res.json({
        status: "success",
        data: entry,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to create timetable entry",
      });
    }
  }
);

// Department Admin: Get timetable by semester with filters
router.get(
  "/:semesterId",
  protect({ role: "department" as const, permissions: {} }),
  async (req: Request, res: Response) => {
    try {
      const semesterId = params(req).semesterId!;
      const query = req.query as {
        departmentId?: string;
        sectionId?: string;
        facultyId?: string;
      };
      const entries = await TimetableService.getEntriesBySemester(
        semesterId,
        query.departmentId,
        query.sectionId,
        query.facultyId
      );
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to fetch timetable",
      });
    }
  }
);

// Department Admin: Get timetable by department
router.get(
  "/department/:departmentId",
  protect({ role: "department" as const, permissions: {} }),
  async (req: Request, res: Response) => {
    try {
      const departmentId = params(req).departmentId!;
      const query = req.query as {
        semesterId?: string;
        sectionId?: string;
        facultyId?: string;
        dayOfWeek?: string;
      };
      const entries = await TimetableService.getEntriesByDepartment(
        departmentId,
        query.semesterId,
        query.sectionId,
        query.facultyId,
        query.dayOfWeek
      );
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch department timetable",
      });
    }
  }
);

// Department Admin: Get entries by course
router.get(
  "/course/:courseId",
  protect({ role: "department" as const, permissions: {} }),
  async (req: Request, res: Response) => {
    try {
      const courseId = params(req).courseId!;
      const query = req.query as {
        semesterId?: string;
        sectionId?: string;
      };
      const entries = await TimetableService.getEntriesByCourse(
        courseId,
        query.semesterId,
        query.sectionId
      );
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch course timetable entries",
      });
    }
  }
);

// Department Admin: Update timetable entry
router.put(
  "/:entryId",
  protect({ role: "department" as const, permissions: {} }),
  async (req: Request, res: Response) => {
    try {
      const parsed = updateTimetableSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          message: "Invalid input data",
        });
        return;
      }

      const entry = await TimetableService.updateEntry(
        params(req).entryId!,
        parsed.data
      );
      res.json({
        status: "success",
        data: entry,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update timetable entry",
      });
    }
  }
);

// Department Admin: Delete timetable entry
router.delete(
  "/:entryId",
  protect({ role: "department" as const, permissions: {} }),
  async (req: Request, res: Response) => {
    try {
      await TimetableService.deleteEntry(params(req).entryId!);
      res.json({
        status: "success",
        message: "Timetable entry deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete timetable entry",
      });
    }
  }
);

// Department Admin: Get template data
router.get(
  "/template/:semesterId",
  protect({ role: "department" as const, permissions: {} }),
  async (req: Request, res: Response) => {
    try {
      const semesterId = params(req).semesterId!;
      const sectionId = req.query.sectionId as string | undefined;
      const templateData = await TimetableService.getTemplateData(
        semesterId,
        sectionId
      );
      res.json({
        status: "success",
        data: templateData,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch template data",
      });
    }
  }
);

export default router;
