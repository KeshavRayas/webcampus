import { z } from "zod";
import { createUserSchema, UpdateAdminUserSchema } from "./user.schema";

export const CreateFinanceUserSchema = createUserSchema.extend({
  role: z.literal("finance"),
});

export const UpdateFinanceUserSchema = UpdateAdminUserSchema;

export type CreateFinanceUserType = z.infer<typeof CreateFinanceUserSchema>;
export type UpdateFinanceUserType = z.infer<typeof UpdateFinanceUserSchema>;
