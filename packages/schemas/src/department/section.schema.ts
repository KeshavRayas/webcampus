import { z } from "zod";

const BASIC_SCIENCES_IDENTIFIER = "BASIC_SCIENCES";

const normalizeDepartmentName = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, "_");

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

export const SectionAllocationSchema = z.object({
  departmentId: z.string().uuid("Invalid department ID"),
  count: z.number().int().min(0),
  selected: z.boolean(),
});

export const GenerateSectionsSchema = z
  .object({
    semesterId: z.string().uuid("Invalid semester ID"),
    departmentName: z.string().min(1, "Department is required"),
    studentsPerSection: z.number().int().min(1).max(200),
    academicYear: z.string().min(1, "Academic year is required"),
    cycle: z.enum(["PHYSICS", "CHEMISTRY"]).optional(),
    allocations: z.array(SectionAllocationSchema).optional(),
  })
  .superRefine((value, ctx) => {
    const usesCycleGeneration =
      !!value.cycle || (value.allocations?.length ?? 0) > 0;

    if (!usesCycleGeneration) {
      return;
    }

    if (
      normalizeDepartmentName(value.departmentName) !==
      BASIC_SCIENCES_IDENTIFIER
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["departmentName"],
        message:
          "First-year section generation payloads are only valid for BASIC_SCIENCES department",
      });
    }
  });

export const GenerateCycleSectionsSchema = z.object({
  termId: z.string().uuid("Invalid term ID"),
  semesterId: z.string().uuid("Invalid semester ID"),
  semesterNumber: z.number().int().min(1).max(8),
  cycle: z.enum(["PHYSICS", "CHEMISTRY"]),
  studentsPerSection: z.number().int().min(1).max(200),
  academicYear: z.string().min(1, "Academic year is required"),
  allocations: z
    .array(SectionAllocationSchema)
    .min(1, "At least one department allocation is required"),
});

export const DetailedGenerationPreviewRequestSchema = z.object({
  semesterId: z.string().uuid("Invalid semester ID"),
  cycle: z.enum(["PHYSICS", "CHEMISTRY"]),
  studentsPerSection: z.number().int().min(1).max(200).optional(),
  allocations: z.array(SectionAllocationSchema),
});

export const DetailedGenerationPreviewSectionSchema = z.object({
  sectionName: z.string().min(1),
  studentUsns: z.array(z.string()),
});

export type BaseSectionType = z.infer<typeof BaseSectionSchema>;
export type CreateSectionType = z.infer<typeof CreateSectionSchema>;
export type SectionResponseType = z.infer<typeof SectionResponseSchema>;
export type SectionQueryType = z.infer<typeof SectionQuerySchema>;
export type GenerateSectionsDTO = z.infer<typeof GenerateSectionsSchema>;
export type SectionAllocationDTO = z.infer<typeof SectionAllocationSchema>;
export type GenerateCycleSectionsDTO = z.infer<
  typeof GenerateCycleSectionsSchema
>;
export type DetailedGenerationPreviewRequestDTO = z.infer<
  typeof DetailedGenerationPreviewRequestSchema
>;
export type DetailedGenerationPreviewSectionDTO = z.infer<
  typeof DetailedGenerationPreviewSectionSchema
>;
