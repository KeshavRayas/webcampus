import { FreezeController } from "@webcampus/api/src/controllers/faculty/freeze.controller";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/",
  protect({
    role: ["admin", "department", "faculty"],
    permissions: {},
  }),
  (req, res, next) => {
    FreezeController.getFreezeState(req, res).catch(next);
  }
);

router.get(
  "/:courseAssignmentId",
  protect({
    role: ["admin", "department", "faculty"],
    permissions: {},
  }),
  (req, res, next) => {
    FreezeController.getFreezeForCourseAssignment(req, res).catch(next);
  }
);

router.patch(
  "/:courseAssignmentId/toggle",
  protect({
    role: ["admin", "department", "faculty"],
    permissions: {},
  }),
  (req, res, next) => {
    FreezeController.toggleFreeze(req, res).catch(next);
  }
);

export default router;
