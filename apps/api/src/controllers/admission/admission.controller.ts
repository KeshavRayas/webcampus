import { Request, Response } from "express";
import { AdmissionService } from "../../services/admission/admission.service";

export class AdmissionController {
  static async create(req: Request, res: Response) {
    try {
      const admission = await AdmissionService.createAdmission(req.body);
      res.json(admission);
    } catch (error) {
      console.error("Admission creation error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async getAll(req: Request, res: Response) {
    try {
      const admissions = await AdmissionService.getAdmissions();
      res.json(admissions);
    } catch {
      res.status(500).json({ error: "Failed to fetch admissions" });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.body;
      await AdmissionService.deleteAdmission(Number(id));
      res.json({
        status: "success",
        message: "Admission deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
