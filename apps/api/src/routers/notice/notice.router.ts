import { NoticeController } from "@webcampus/api/src/controllers/notice/notice.controller";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Router, type Router as ExpressRouter } from "express";

const router: ExpressRouter = Router();
router.get(
  "/department",
  protect({ role: "department", permissions: {} }),
  NoticeController.listDepartment
);
router.post(
  "/department",
  protect({ role: "department", permissions: {} }),
  NoticeController.create
);
router.put(
  "/department/:noticeId",
  protect({ role: "department", permissions: {} }),
  NoticeController.update
);
router.delete(
  "/department/:noticeId",
  protect({ role: "department", permissions: {} }),
  NoticeController.remove
);
router.patch(
  "/department/:noticeId/status",
  protect({ role: "department", permissions: {} }),
  NoticeController.setStatus
);
router.get(
  "/student",
  protect({ role: "student", permissions: {} }),
  NoticeController.listStudents
);
router.get(
  "/faculty",
  protect({ role: "faculty", permissions: {} }),
  NoticeController.listFaculty
);
export default router;
