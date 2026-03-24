import { z } from "zod";

export const BaseSectionSchema = z.object({
  name: z.string().min(1, "Section name is required"),
  departmentName: z.string("Invalid department name"),
  semesterId: z.uuid({ error: "Invalid semester ID" }),
});

export const CreateSectionSchema = BaseSectionSchema;

export const SectionResponseSchema = BaseSectionSchema.extend({
  id: z.uuid("Invalid section ID"),
});

export const SectionQuerySchema = SectionResponseSchema.partial();

export const GenerateSectionsSchema = z.object({
  semesterId: z.string().uuid("Invalid semester ID"),
  departmentName: z.string().min(1, "Department is required"),
  studentsPerSection: z.number().int().min(1).max(200),
  academicYear: z.string().min(1, "Academic year is required"),
});

export type BaseSectionType = z.infer<typeof BaseSectionSchema>;
export type CreateSectionType = z.infer<typeof CreateSectionSchema>;
export type SectionResponseType = z.infer<typeof SectionResponseSchema>;
export type SectionQueryType = z.infer<typeof SectionQuerySchema>;
export type GenerateSectionsDTO = z.infer<typeof GenerateSectionsSchema>;
