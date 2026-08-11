import { ProctorController } from "@webcampus/api/src/controllers/student/proctor.controller";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";

const router: Router = Router();

router.use(protect({ role: "student", permissions: {} }));

router.get("/", ProctorController.getProctor);

export default router;
