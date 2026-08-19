import { DepartmentController } from "@webcampus/api/src/controllers/admin/department.controller";
import { sendResponse } from "@webcampus/backend-utils/helpers";
import { protect } from "@webcampus/backend-utils/middlewares";
import { ErrorRequestHandler, Router } from "express";
import multer from "multer";
import admissionCancelRouter from "./admission-cancel.router";
import admissionConstantsRouter from "./admission-constants.router";
import admissionCreateRouter from "./admission-create.router";
import admissionFeeRouter from "./admission-fee.router";
import admissionReportRouter from "./admission-report.router";
import admissionViewRouter from "./admission-view.router";
import admissionUploadRouter from "./admission.upload.router";

const router: Router = Router();

router.use(admissionUploadRouter);
router.use(admissionConstantsRouter);
router.use(admissionReportRouter);
router.use(admissionFeeRouter);
router.use(admissionCreateRouter);
router.use(admissionViewRouter);
router.use(admissionCancelRouter);

router.get(
  "/departments",
  protect({
    role: ["applicant", "admin", "admission", "admission-instructor"],
    permissions: { department: ["read"] },
  }),
  DepartmentController.getPublicDepartments
);

const uploadErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  void _next;

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    sendResponse({
      res,
      status: "error",
      statusCode: 413,
      message: "Each uploaded document must be less than 2 MB.",
      error,
    });
    return;
  }

  sendResponse({
    res,
    status: "error",
    statusCode: 400,
    message: error instanceof Error ? error.message : "Upload failed",
    error,
  });
};

router.use(uploadErrorHandler);

export default router;
