import { z } from "zod";

export const CreateProgrammeOutcomeSchema = z.object({
  programType: z.enum(["UG", "PG"]),
  // "" is the form's "None (Common)" sentinel — accepted here then
  // normalized to null in the dialog/controller before DB write.
  departmentId: z
    .string()
    .uuid("Invalid department ID")
    .or(z.literal(""))
    .nullable()
    .optional(),
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
