import { FileController } from "@webcampus/api/src/controllers/file-management/file.controller";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";

const router: Router = Router();

// Express 5 / path-to-regexp v8 dropped string wildcard support like /* or /:key(.*)
// Using a RegExp object avoids the parsing error entirely.
router.get(
  /.*/,
  protect({
    role: [
      "admin",
      "hod",
      "department",
      "faculty",
      "student",
      "coe",
      "accounts",
      "admission",
      "coordinator",
      "trust",
    ],
    permissions: {},
  }),
  FileController.serveFile
);

export default router;
