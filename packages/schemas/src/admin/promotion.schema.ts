import { z } from "zod";

const optionalQueryString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

export const PromotionCandidatesQuerySchema = z
  .object({
    fromSemesterId: z.uuid("Invalid source semester ID"),
    toSemesterId: z.uuid("Invalid target semester ID"),
  })
  .refine((value) => value.fromSemesterId !== value.toSemesterId, {
    message: "Source and target semester must differ",
    path: ["toSemesterId"],
  });

export const PromoteStudentsSchema = z
  .object({
    fromSemesterId: z.uuid("Invalid source semester ID"),
    toSemesterId: z.uuid("Invalid target semester ID"),
    studentIds: z
      .array(z.uuid("Invalid student ID"))
      .min(1, "Select at least one student"),
    notes: optionalQueryString(z.string().max(500)),
    academicYear: optionalQueryString(z.string().max(20)),
    promoteFirstYearSections: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.fromSemesterId === value.toSemesterId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toSemesterId"],
        message: "Source and target semester must differ",
      });
    }
    const uniqueIds = new Set(value.studentIds);
    if (uniqueIds.size !== value.studentIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentIds"],
        message: "Duplicate student IDs in selection",
      });
    }
    if (value.promoteFirstYearSections && !value.academicYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["academicYear"],
        message: "academicYear is required when promoting first year sections",
      });
    }
  });

export const PromotionHistoryQuerySchema = z.object({
  academicTermId: optionalQueryString(z.uuid("Invalid academic term ID")),
  studentId: optionalQueryString(z.uuid("Invalid student ID")),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type PromotionCandidatesQueryType = z.infer<
  typeof PromotionCandidatesQuerySchema
>;
export type PromoteStudentsType = z.infer<typeof PromoteStudentsSchema>;
export type PromotionHistoryQueryType = z.infer<
  typeof PromotionHistoryQuerySchema
>;
