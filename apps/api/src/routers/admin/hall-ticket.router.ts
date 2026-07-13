import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";
import {
  downloadStudentHallTicketPdf,
  getAcademicTerms,
  getDepartments,
  getStudentHallTicketData,
  listEligibleStudents,
  sendHallTickets,
  unsendHallTickets,
} from "../../controllers/admin/hall-ticket.controller";

const router: Router = Router();

router.use(
  protect({
    role: "admin",
    permissions: {},
  })
);

router.get("/terms", getAcademicTerms);
router.get("/departments", getDepartments);
router.get("/", listEligibleStudents);
router.get("/:studentId/:academicTermId", getStudentHallTicketData);
router.get("/:studentId/:academicTermId/pdf", downloadStudentHallTicketPdf);

router.post("/send", sendHallTickets);
router.post("/unsend", unsendHallTickets);

export default router;
