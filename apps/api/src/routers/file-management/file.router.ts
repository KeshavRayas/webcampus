import { FileController } from "@webcampus/api/src/controllers/file-management/file.controller";
import { Router } from "express";

const router: Router = Router();

// Express 5 / path-to-regexp v8 dropped string wildcard support like /* or /:key(.*)
// Using a RegExp object avoids the parsing error entirely.
router.get(/.*/, FileController.serveFile);

export default router;
