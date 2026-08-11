import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";
import {
  createTemplate,
  deleteTemplate,
  getCampaign,
  getTemplateFields,
  listCampaigns,
  listCourses,
  listTemplates,
  previewMessage,
  sendMessage,
  updateTemplate,
} from "../../controllers/admin/whatsapp.controller";

const router: Router = Router();

router.use(
  protect({
    role: "admin",
    permissions: {},
  })
);

router.get("/templates", listTemplates);
router.post("/templates", createTemplate);
router.put("/templates/:id", updateTemplate);
router.delete("/templates/:id", deleteTemplate);

router.get("/templates/fields", getTemplateFields);

router.get("/courses", listCourses);

router.post("/preview", previewMessage);
router.post("/send", sendMessage);

router.get("/campaigns", listCampaigns);
router.get("/campaigns/:id", getCampaign);

export default router;
