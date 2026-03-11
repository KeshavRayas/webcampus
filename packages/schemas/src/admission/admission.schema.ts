import { z } from "zod";

export const CreateAdmissionShellSchema = z.object({
  applicationId: z.string().min(1, "Application ID is required"),
  modeOfAdmission: z.string().min(1, "Mode of Admission is required"),
  semesterId: z.string().uuid("Invalid Semester ID"),
});

export type CreateAdmissionShellType = z.infer<
  typeof CreateAdmissionShellSchema
>;
