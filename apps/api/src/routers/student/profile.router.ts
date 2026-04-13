import { StudentProfileController } from "@webcampus/api/src/controllers/student/profile.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  StudentProfileRequestApprovalSchema,
  UpdateStudentProfileSchema,
} from "@webcampus/schemas/student";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

router.use(
  protect({
    role: ["student", "admin"],
    permissions: {},
  })
);

router.get("/", StudentProfileController.getMyProfile);
router.put("/", validateRequest(UpdateStudentProfileSchema), StudentProfileController.updateMyProfile);
router.post(
  "/request-approval",
  validateRequest(StudentProfileRequestApprovalSchema),
  StudentProfileController.requestProfileApproval
);

export default router;
