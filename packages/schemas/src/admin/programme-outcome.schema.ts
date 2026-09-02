import { z } from "zod";

export const CreateProgrammeOutcomeSchema = z.object({
  programType: z.enum(["UG", "PG"]),
  departmentId: z.string().uuid("Invalid department ID").optional().nullable(),
  type: z.enum(["PEO", "PSO", "PO"]),
  code: z.string().min(1, "Code is required"),
  description: z.string().min(1, "Description is required"),
  isActive: z.boolean().default(true),
});

export type CreateProgrammeOutcomeType = z.infer<
  typeof CreateProgrammeOutcomeSchema
>;

export const UpdateProgrammeOutcomeSchema =
  CreateProgrammeOutcomeSchema.partial();

export type UpdateProgrammeOutcomeType = z.infer<
  typeof UpdateProgrammeOutcomeSchema
>;
