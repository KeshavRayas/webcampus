import { z } from "zod";
import { createUserSchema, UpdateAdminUserSchema } from "./user.schema";

export const CreateAccountsUserSchema = createUserSchema.extend({
  role: z.literal("accounts"),
});

export const UpdateAccountsUserSchema = UpdateAdminUserSchema;

export type CreateAccountsUserType = z.infer<typeof CreateAccountsUserSchema>;
export type UpdateAccountsUserType = z.infer<typeof UpdateAccountsUserSchema>;
