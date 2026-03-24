import { z } from "zod";

export const CreateAdmissionUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z.string().min(1, "Username is required"),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admission_admin", "admission_reviewer"]),
});

export type CreateAdmissionUserType = z.infer<typeof CreateAdmissionUserSchema>;
