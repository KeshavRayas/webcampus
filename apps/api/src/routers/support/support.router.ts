import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  CreateSupportMessageSchema,
  CreateSupportTicketSchema,
  UpdateSupportTicketStatusSchema,
} from "@webcampus/schemas/support";
import { Router } from "express";
import multer from "multer";
import { SupportController } from "../../controllers/support/support.controller";

const router: Router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

router.use(
  protect({
    permissions: { support: ["read"] },
  })
);

router.get("/tickets", SupportController.listTickets);
router.get("/tickets/:ticketId", SupportController.getTicket);
router.get(
  "/attachments/:attachmentId/download",
  SupportController.getAttachmentDownloadUrl
);
router.post(
  "/tickets",
  upload.array("attachments", 5),
  protect({ permissions: { support: ["create"] } }),
  validateRequest(CreateSupportTicketSchema),
  SupportController.createTicket
);
router.post(
  "/tickets/:ticketId/messages",
  upload.array("attachments", 5),
  protect({ permissions: { support: ["reply"] } }),
  validateRequest(CreateSupportMessageSchema),
  SupportController.addMessage
);
router.patch(
  "/tickets/:ticketId/status",
  protect({ role: "admin", permissions: { support: ["updateStatus"] } }),
  validateRequest(UpdateSupportTicketStatusSchema),
  SupportController.updateStatus
);

export default router;
