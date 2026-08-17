import { TimetableExcelService } from "@webcampus/api/src/services/timetable/timetable-excel.service";
import { TimetableService } from "@webcampus/api/src/services/timetable/timetable.service";
import { getDepartmentRequestContext } from "@webcampus/api/src/utils/request-context";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Router as ExpressRouter, Router } from "express";
import multer from "multer";

const router: ExpressRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });
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
    const semesterId = requestParams(req).semesterId!;
    const entries = await TimetableService.getTodayEntries(semesterId);
    res.json({
      status: "success",
      data: entries,
    });
  }
);

// Get weekly timetable for a student
router.get(
  "/weekly/:semesterId",
  protect({ role: "student", permissions: {} }),
  async (req, res) => {
    const semesterId = requestParams(req).semesterId!;
    const entries = await TimetableService.getEntriesBySemester(semesterId);
    res.json({
      status: "success",
      data: entries,
    });
  }
);

// Download timetable (student)
router.get(
  "/download/:semesterId",
  protect({ role: "student", permissions: {} }),
  async (req, res) => {
    const semesterId = requestParams(req).semesterId!;
    const entries = await TimetableService.getEntriesBySemester(semesterId);
    // Generate download response
    res.json({
      status: "success",
      data: entries,
      download: true,
    });
  }
);

// Download timetable with section (student)
router.get(
  "/download/:semesterId/:sectionId",
  protect({ role: "student", permissions: {} }),
  async (req, res) => {
    const semesterId = requestParams(req).semesterId!;
    const sectionId = requestParams(req).sectionId!;
    const entries = await TimetableService.getEntriesBySemester(
      semesterId,
      undefined,
      sectionId
    );
    // Generate download response
    res.json({
      status: "success",
      data: entries,
      download: true,
    });
  }
);

// ============ Faculty Routes ============

// Get today's assigned classes for faculty
router.get(
  "/faculty/today/:semesterId",
  protect({ role: "faculty", permissions: {} }),
  async (req, res) => {
    const semesterId = requestParams(req).semesterId!;
    const facultyId = undefined;
    const entries = await TimetableService.getTodayEntries(
      semesterId,
      facultyId
    );
    res.json({
      status: "success",
      data: entries,
    });
  }
);

// Get weekly teaching timetable for faculty
router.get(
  "/faculty/weekly/:semesterId",
  protect({ role: "faculty", permissions: {} }),
  async (req, res) => {
    const semesterId = requestParams(req).semesterId!;
    const facultyId = undefined;
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
  }
);

// ============ Department Admin Routes ============

// Create timetable entry (Department Admin)
router.post(
  "/",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
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
  }
);

// Get timetable by semester with filters
router.get(
  "/:semesterId",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
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
  }
);

// Get timetable by department with filters
router.get(
  "/department/:departmentId",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
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
  }
);

// Get entries by course
router.get(
  "/course/:courseId",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
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
  }
);

// Update timetable entry (Department Admin)
router.put(
  "/:entryId",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
    const entry = await TimetableService.updateEntry(
      requestParams(req).entryId!,
      req.body
    );
    res.json({
      status: "success",
      data: entry,
    });
  }
);

// Delete timetable entry (Department Admin)
router.delete(
  "/:entryId",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
    await TimetableService.deleteEntry(requestParams(req).entryId!);
    res.json({
      status: "success",
      message: "Timetable entry deleted successfully",
    });
  }
);

// Get template data for department admin
router.get(
  "/template/:semesterId",
  protect({ role: "department", permissions: {} }),
  async (req, res) => {
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
        return res
          .status(400)
          .json({
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
        return res
          .status(400)
          .json({
            status: "error",
            message:
              "Each time slot must have a label and valid start/end times",
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
      return res
        .status(400)
        .json({
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
        return res
          .status(400)
          .json({
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
      return res
        .status(400)
        .json({
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
        return res
          .status(400)
          .json({
            status: "error",
            message: "semesterId, slots and file are required",
          });
      return res.json({
        status: "success",
        data: await TimetableExcelService.parse(file.buffer, semesterId, slots),
      });
    } catch (error) {
      return res
        .status(400)
        .json({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to validate timetable workbook",
        });
    }
  }
);

export default router;
