import { StudentMarksController } from "@webcampus/api/src/controllers/student/marks.controller";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";

const router: Router = Router();

router.use(
  protect({
    role: "student",
    permissions: {},
  })
);

router.get("/summary", StudentMarksController.getSummary);

export default router;
