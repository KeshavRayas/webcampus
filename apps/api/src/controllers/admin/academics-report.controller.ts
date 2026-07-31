import { AdminAttendanceReportService } from "@webcampus/api/src/services/admin/academics/admin-attendance-report.service";
import { AdminCondonationReportService } from "@webcampus/api/src/services/admin/academics/admin-condonation-report.service";
import { AdminMarksReportService } from "@webcampus/api/src/services/admin/academics/admin-marks-report.service";
import { Request, Response } from "express";

export const getCourses = async (req: Request, res: Response) => {
  try {
    const { departmentId, semesterId, cycle } = req.query;
    if (!departmentId || !semesterId) {
      return res
        .status(400)
        .json({ error: "Missing required query parameters" });
    }
    const response = await AdminAttendanceReportService.getCourses(
      departmentId as string,
      semesterId as string,
      cycle as string
    );
    res.json(response);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getSections = async (req: Request, res: Response) => {
  try {
    const { departmentId, semesterId, courseId, cycle } = req.query;
    if (!departmentId || !semesterId || !courseId) {
      return res
        .status(400)
        .json({ error: "Missing required query parameters" });
    }
    const response = await AdminAttendanceReportService.getSections(
      departmentId as string,
      semesterId as string,
      courseId as string,
      cycle as string
    );
    res.json(response);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getAttendanceStatusReport = async (
  req: Request,
  res: Response
) => {
  try {
    const { courseId, sectionId, batchId } = req.query;
    if (!courseId || !sectionId) {
      return res
        .status(400)
        .json({ error: "Missing required query parameters" });
    }
    const response = await AdminAttendanceReportService.getStatusReport(
      courseId as string,
      sectionId as string,
      batchId as string
    );
    res.json(response);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getAttendanceDetailedReport = async (
  req: Request,
  res: Response
) => {
  try {
    const { courseId, sectionId, batchId } = req.query;
    if (!courseId || !sectionId) {
      return res
        .status(400)
        .json({ error: "Missing required query parameters" });
    }
    const response = await AdminAttendanceReportService.getDetailedReport(
      courseId as string,
      sectionId as string,
      batchId as string
    );
    res.json(response);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getMarksDetailedReport = async (req: Request, res: Response) => {
  try {
    const { courseId, sectionId } = req.query;
    if (!courseId) {
      return res
        .status(400)
        .json({ error: "Missing required query parameters" });
    }
    const response = await AdminMarksReportService.getMarksReport(
      courseId as string,
      sectionId as string
    );
    res.json(response);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getCondonationDetailedReport = async (
  req: Request,
  res: Response
) => {
  try {
    const { courseId, sectionId, batchId } = req.query;
    if (!courseId || !sectionId) {
      return res
        .status(400)
        .json({ error: "Missing required query parameters" });
    }
    const response = await AdminCondonationReportService.getCondonationReport(
      courseId as string,
      sectionId as string,
      batchId as string
    );
    res.json(response);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
};
