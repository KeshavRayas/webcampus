import { UserController } from "@webcampus/api/src/controllers/admin/user.controller";
import { protect, validateRequest } from "@webcampus/backend-utils/middlewares";
import { createUserSchema, UsersQuerySchema } from "@webcampus/schemas/admin";
import { Router } from "express";

const router: Router = Router();

router.post(
  "/",
  protect({
    role: "admin",
    permissions: {
      user: ["set-role"],
    },
  }),
  validateRequest(createUserSchema),
  UserController.createUser
);

router.delete(
  "/",
  protect({
    role: "admin",
    permissions: {
      user: ["delete"],
    },
  }),
  UserController.deleteUser
);

router.get(
  "/",
  protect({
    role: "admin",
    permissions: {
      user: ["get"],
    },
  }),
  validateRequest(UsersQuerySchema, "query"),
  UserController.getUsers
);

export default router;
