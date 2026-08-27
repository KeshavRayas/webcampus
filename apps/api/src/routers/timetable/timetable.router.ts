import { resolveFacultyIdForUser } from "@webcampus/api/src/services/faculty/resolve-faculty-for-user";
import { TimetableExcelService } from "@webcampus/api/src/services/timetable/timetable-excel.service";
import { TimetableService } from "@webcampus/api/src/services/timetable/timetable.service";
import { getDepartmentRequestContext } from "@webcampus/api/src/utils/request-context";
import { upload } from "@webcampus/api/src/utils/upload";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Router as ExpressRouter, Router } from "express";

const router: ExpressRouter = Router();
type RequestWithContext = import("express").Request & {
  requestContext?: { userId?: string };
};
type UploadedRequest = RequestWithContext & { file?: { buffer?: Buffer } };
const requestParams = (req: RequestWithContext) =>
  req.params as Record<string, string | undefined>;

// ============ Student Routes ============

// Get today's timetable for a student (requires authentication)
router.get(
  "/today/:semesterId",
  protect({ role: "student", permissions: {} }),
  async (req, res) => {
    try {
      const semesterId = requestParams(req).semesterId!;
      const sectionId = req.query.sectionId as string | undefined;
      const entries = await TimetableService.getTodayEntries(
        semesterId,
        undefined,
        sectionId
      );
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to fetch timetable",
      });
    }
  }
);

// Get weekly timetable for a student
router.get(
  "/weekly/:semesterId",
  protect({ role: "student", permissions: {} }),
  async (req, res) => {
    try {
      const semesterId = requestParams(req).semesterId!;
      const sectionId = req.query.sectionId as string | undefined;
      const entries = await TimetableService.getEntriesBySemester(
        semesterId,
        undefined,
        sectionId,
        undefined,
        "PUBLISHED"
      );
      const slots = await TimetableService.getSlotsForSection(
        semesterId,
        sectionId
      );
      res.json({
        status: "success",
        data: entries,
        slots,
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to fetch timetable",
      });
    }
  }
);

// Download timetable (student)
router.get(
  "/download/:semesterId",
  protect({ role: "student", permissions: {} }),
  async (req, res) => {
    try {
      const semesterId = requestParams(req).semesterId!;
      const entries = await TimetableService.getEntriesBySemester(semesterId);
      res.json({
        status: "success",
        data: entries,
        download: true,
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to download timetable",
      });
    }
  }
);

// Download timetable with section (student)
router.get(
  "/download/:semesterId/:sectionId",
  protect({ role: "student", permissions: {} }),
  async (req, res) => {
    try {
      const semesterId = requestParams(req).semesterId!;
      const sectionId = requestParams(req).sectionId!;
      const entries = await TimetableService.getEntriesBySemester(
        semesterId,
        undefined,
        sectionId
      );
      res.json({
        status: "success",
        data: entries,
        download: true,
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to download timetable",
      });
    }
  }
);

// ============ Faculty Routes ============

// Get today's assigned classes for faculty
router.get(
  "/faculty/today/:semesterId",
  protect({ role: "faculty", permissions: {} }),
  async (req, res) => {
    try {
      const semesterId = requestParams(req).semesterId!;
      const userId = req.requestContext?.userId;
      if (!userId) {
        res.status(401).json({ status: "error", message: "Unauthorized" });
        return;
      }
      const facultyId = await resolveFacultyIdForUser(userId);
      const entries = await TimetableService.getTodayEntries(
        semesterId,
        facultyId
      );
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(403).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Faculty profile not found",
      });
    }
  }
);

// Get weekly teaching timetable for faculty
router.get(
  "/faculty/weekly/:semesterId",
  protect({ role: "faculty", permissions: {} }),
  async (req, res) => {
    try {
      const semesterId = requestParams(req).semesterId!;
      const userId = req.requestContext?.userId;
      if (!userId) {
        res.status(401).json({ status: "error", message: "Unauthorized" });
        return;
      }
      const facultyId = await resolveFacultyIdForUser(userId);
      const entries = await TimetableService.getEntriesByFaculty(
        facultyId,
        semesterId
      );
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(403).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Faculty profile not found",
      });
    }
  }
);

// ============ Department Admin Routes ============

// Create timetable entry (Department Admin)
router.post(
  "/",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
    try {
      const userId = req.requestContext?.userId || "system";
      const entry = await TimetableService.createEntry(
        {
          ...req.body,
          academicYear: req.body.academicYear || "",
          semesterId: req.body.semesterId,
        } as import("@webcampus/api/src/services/timetable/timetable.service").CreateTimetableEntryDTO,
        userId
      );
      res.json({
        status: "success",
        data: entry,
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to create timetable entry",
      });
    }
  }
);

// Get timetable by semester with filters
router.get(
  "/:semesterId",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
    try {
      const semesterId = requestParams(req).semesterId!;
      const query = req.query as Record<string, string | undefined>;
      const departmentId = query.departmentId as string | undefined;
      const sectionId = query.sectionId as string | undefined;
      const facultyId = query.facultyId as string | undefined;
      const entries = await TimetableService.getEntriesBySemester(
        semesterId,
        departmentId,
        sectionId,
        facultyId
      );
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to fetch timetable",
      });
    }
  }
);

// Get timetable by department with filters
router.get(
  "/department/:departmentId",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
    try {
      const departmentId = requestParams(req).departmentId!;
      const query = req.query as Record<string, string | undefined>;
      const semesterId = query.semesterId as string | undefined;
      const sectionId = query.sectionId as string | undefined;
      const facultyId = query.facultyId as string | undefined;
      const dayOfWeek = query.dayOfWeek as string | undefined;
      const entries = await TimetableService.getEntriesByDepartment(
        departmentId,
        semesterId,
        sectionId,
        facultyId,
        dayOfWeek
      );
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to fetch timetable",
      });
    }
  }
);

// Get entries by course
router.get(
  "/course/:courseId",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
    try {
      const courseId = requestParams(req).courseId!;
      const query = req.query as Record<string, string | undefined>;
      const semesterId = query.semesterId as string | undefined;
      const sectionId = query.sectionId as string | undefined;
      const entries = await TimetableService.getEntriesByCourse(
        courseId,
        semesterId,
        sectionId
      );
      res.json({
        status: "success",
        data: entries,
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to fetch timetable",
      });
    }
  }
);

// Update timetable entry (Department Admin)
router.put(
  "/:entryId",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
    try {
      const entry = await TimetableService.updateEntry(
        requestParams(req).entryId!,
        req.body
      );
      res.json({
        status: "success",
        data: entry,
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update timetable entry",
      });
    }
  }
);

// Delete timetable entry (Department Admin)
router.delete(
  "/:entryId",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
    try {
      await TimetableService.deleteEntry(requestParams(req).entryId!);
      res.json({
        status: "success",
        message: "Timetable entry deleted successfully",
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete timetable entry",
      });
    }
  }
);

// Get template data for department admin
router.get(
  "/template/:semesterId",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
    try {
      const semesterId = requestParams(req).semesterId!;
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
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to fetch template",
      });
    }
  }
);

router.put(
  "/template/:semesterId",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
    try {
      const context = await getDepartmentRequestContext(req);
      const semesterId = String(requestParams(req).semesterId);
      const slots = req.body?.slots;
      if (!Array.isArray(slots) || !slots.length)
        return res.status(400).json({
          status: "error",
          message: "At least one time slot is required",
        });
      const invalid = slots.some(
        (slot) =>
          !slot?.label ||
          !slot?.startTime ||
          !slot?.endTime ||
          slot.startTime >= slot.endTime
      );
      if (invalid)
        return res.status(400).json({
          status: "error",
          message: "Each time slot must have a label and valid start/end times",
        });
      return res.json({
        status: "success",
        data: await TimetableService.saveTemplate(
          context.departmentId,
          semesterId,
          slots
        ),
      });
    } catch (error) {
      return res.status(400).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save timetable template",
      });
    }
  }
);

router.get(
  "/excel/template",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
    try {
      const semesterId = String(req.query.semesterId ?? "");
      const slots = JSON.parse(String(req.query.slots ?? "[]"));
      if (!semesterId || !Array.isArray(slots) || !slots.length)
        return res.status(400).json({
          status: "error",
          message: "semesterId and slots are required",
        });
      const buffer = await TimetableExcelService.template(semesterId, slots);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=timetable-template.xlsx"
      );
      return res.send(buffer);
    } catch (error) {
      return res.status(400).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate timetable template",
      });
    }
  }
);

router.post(
  "/excel/validate",
  protect({ role: "department", permissions: {} }),
  upload.single("file"),
  async (req: UploadedRequest, res) => {
    try {
      const semesterId = String(req.body?.semesterId ?? "");
      const slots = JSON.parse(String(req.body?.slots ?? "[]"));
      const file = req.file;
      if (!semesterId || !file?.buffer || !Array.isArray(slots))
        return res.status(400).json({
          status: "error",
          message: "semesterId, slots and file are required",
        });
      return res.json({
        status: "success",
        data: await TimetableExcelService.parse(file.buffer, semesterId, slots),
      });
    } catch (error) {
      return res.status(400).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to validate timetable workbook",
      });
    }
  }
);

router.post(
  "/excel/import",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
    try {
      const context = await getDepartmentRequestContext(req);
      const { semesterId, entries } = req.body as {
        semesterId: string;
        entries: Array<{
          courseId: string;
          dayOfWeek: import("@webcampus/api/src/services/timetable/timetable.service").CreateTimetableEntryDTO["dayOfWeek"];
          startTime: string;
          endTime: string;
          sectionId?: string;
          classType: "LECTURE" | "LAB";
        }>;
      };
      if (!semesterId || !Array.isArray(entries) || !entries.length) {
        return res.status(400).json({
          status: "error",
          message: "semesterId and entries are required",
        });
      }
      const result = await TimetableService.importEntries(
        context.departmentId,
        semesterId,
        entries
      );
      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to import timetable entries",
      });
    }
  }
);

export default router;
