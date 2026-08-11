import { ArchiveController } from "@webcampus/api/src/controllers/admin/archive.controller";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";

const router: Router = Router();

router.get(
  "/semester/:id",
  protect({
    role: "admin",
    permissions: {
      semester: ["read"],
    },
  }),
  ArchiveController.getArchiveSummary
);

router.get(
  "/",
  protect({
    role: "admin",
    permissions: {
      semester: ["read"],
    },
  }),
  ArchiveController.getAllArchives
);

export default router;
