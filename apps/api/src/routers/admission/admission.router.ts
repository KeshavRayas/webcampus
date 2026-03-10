import { Router } from "express";
import { AdmissionController } from "../../controllers/admission/admission.controller";

const router = Router();

router.post("/", AdmissionController.create);
router.get("/", AdmissionController.getAll);
router.delete("/", AdmissionController.delete);

export default router;
