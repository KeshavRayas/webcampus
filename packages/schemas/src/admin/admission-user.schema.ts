import { z } from "zod";

export const CreateAdmissionUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z.string().min(1, "Username is required"),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admission_admin"]),
  photo: z.any().optional(),
});

export const UpdateAdmissionUserSchema = CreateAdmissionUserSchema.omit({
  password: true,
  photo: true,
  role: true,
});

export type CreateAdmissionUserType = z.infer<typeof CreateAdmissionUserSchema>;
export type UpdateAdmissionUserType = z.infer<typeof UpdateAdmissionUserSchema>;
