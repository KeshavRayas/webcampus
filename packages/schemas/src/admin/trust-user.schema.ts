import { z } from "zod";
import { createUserSchema, UpdateAdminUserSchema } from "./user.schema";

export const CreateTrustUserSchema = createUserSchema.extend({
  role: z.literal("trust"),
});

export const UpdateTrustUserSchema = UpdateAdminUserSchema;

export type CreateTrustUserType = z.infer<typeof CreateTrustUserSchema>;
export type UpdateTrustUserType = z.infer<typeof UpdateTrustUserSchema>;
