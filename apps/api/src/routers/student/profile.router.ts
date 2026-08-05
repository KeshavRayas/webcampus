import { StudentProfileController } from "@webcampus/api/src/controllers/student/profile.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { StudentProfileRequestApprovalSchema } from "@webcampus/schemas/student";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

router.use(
  protect({
    role: "student",
    permissions: {},
  })
);

router.get("/", StudentProfileController.getMyProfile);
router.post(
  "/request-approval",
  validateRequest(StudentProfileRequestApprovalSchema),
  StudentProfileController.requestProfileApproval
);

export default router;
