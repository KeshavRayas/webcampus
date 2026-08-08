import { ProctorController } from "@webcampus/api/src/controllers/faculty/proctor.controller";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";

const router: Router = Router();

router.use(protect({ role: "faculty", permissions: {} }));

router.get("/students", ProctorController.getStudents);

export default router;
