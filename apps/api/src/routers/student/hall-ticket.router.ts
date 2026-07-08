import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";
import {
  downloadMyHallTicketPdf,
  getMyHallTicketData,
  getMyHallTickets,
} from "../../controllers/student/hall-ticket.controller";

const router: Router = Router();

router.use(
  protect({
    role: "student",
    permissions: {},
  })
);

router.get("/", getMyHallTickets);
router.get("/:academicTermId", getMyHallTicketData);
router.get("/:academicTermId/pdf", downloadMyHallTicketPdf);

export default router;
