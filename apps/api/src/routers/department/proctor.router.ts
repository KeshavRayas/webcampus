import { ProctorController } from "@webcampus/api/src/controllers/department/proctor.controller";
import { protect } from "@webcampus/backend-utils/middlewares";
import { Router } from "express";

const router: Router = Router();

router.use(protect({ role: "department", permissions: {} }));

router.get("/", ProctorController.getAllGroups);
router.post("/", ProctorController.createGroup);
router.put("/:id", ProctorController.assignFaculty);
router.delete("/:id", ProctorController.deleteGroup);
router.get("/students", ProctorController.getStudents);
router.post("/assign-students", ProctorController.assignStudents);

export default router;
