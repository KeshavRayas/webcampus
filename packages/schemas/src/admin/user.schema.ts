import { Role, roles } from "@webcampus/types/rbac";
import { z } from "zod";

export const BaseUserSchema = z.object({
  email: z.email("Invalid email address"),
  username: z.string().min(1, "This field is required").nullable(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
  role: z
    .string()
    .refine((val) => roles.includes(val as Role), {
      message: "Invalid role",
    })
    .nullable(),
});

export const CreateUserSchema = BaseUserSchema;

export const UserResponseSchema = BaseUserSchema.extend({
  id: z.string(),
  displayUsername: z.string().nullable(),
  emailVerified: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  banned: z.boolean().nullable(),
  banReason: z.string().nullable(),
  banExpires: z.date().nullable(),
}).omit({
  password: true,
});

export const UsersQuerySchema = UserResponseSchema.partial().extend({
  role: z.string().or(z.array(z.string())),
});

export const createUserSchema = z.object({
  email: z.email("Invalid email address"),
  username: z.string().min(1, "This field is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.string(),
});

export const UpdateUserProfileSchema = z.object({
  username: z.string().min(1, "Username is required"),
  displayUsername: z.string().min(1, "Display username is required"),
});

export const UpdateUserProfileParamsSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

export const BackfillUserProfileFieldsSchema = z.object({
  force: z.boolean().optional().default(false),
});

export type CreateUserType = z.infer<typeof createUserSchema>;
export type CreateUserDTO = z.infer<typeof CreateUserSchema>;
export type UserResponseType = z.infer<typeof UserResponseSchema>;
export type BaseUserDTO = z.infer<typeof BaseUserSchema>;
export type UsersQueryDTO = z.infer<typeof UsersQuerySchema>;
export type UpdateUserProfileType = z.infer<typeof UpdateUserProfileSchema>;
export type UpdateUserProfileParamsType = z.infer<
  typeof UpdateUserProfileParamsSchema
>;
export type BackfillUserProfileFieldsType = z.infer<
  typeof BackfillUserProfileFieldsSchema
>;
