import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import {
  AssignReRegistrationStudentsSchema,
  CreateReRegistrationOfferingSchema,
  GetReRegistrationOfferingsQuerySchema,
  ReRegistrationOfferingParamsSchema,
} from "@webcampus/schemas/admin";
import { Router } from "express";
import { ReRegistrationOfferingController } from "../../controllers/admin/re-registration-offering.controller";

const router = Router();

router.use(
  protect({
    role: "admin",
    permissions: {
      reRegistrationOffering: ["create", "read"],
    },
  })
);

router.post(
  "/",
  validateRequest(CreateReRegistrationOfferingSchema),
  ReRegistrationOfferingController.create
);

router.get(
  "/",
  validateRequest(GetReRegistrationOfferingsQuerySchema, "query"),
  ReRegistrationOfferingController.list
);

router.post(
  "/:id/students",
  validateRequest(ReRegistrationOfferingParamsSchema, "params"),
  validateRequest(AssignReRegistrationStudentsSchema),
  ReRegistrationOfferingController.assignStudents
);

export default router;
