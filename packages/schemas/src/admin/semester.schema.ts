import { z } from "zod";

export const SemesterTypeSchema = z.enum(["even", "odd"]);

export const BaseSemesterSchema = z.object({
  type: SemesterTypeSchema,
  year: z.string().min(4, { error: "Year is required" }),
  semesterNumber: z.number().int().min(1).max(8),

  /**
   * Just a temporary fix to get the date from the form.
   * https://github.com/colinhacks/zod/issues/4236#issuecomment-3101645579
   */
  startDate: z.coerce.date() as z.ZodDate,
  /**
   * Just a temporary fix to get the date from the form.
   * https://github.com/colinhacks/zod/issues/4236#issuecomment-3101645579
   */
  endDate: z.coerce.date() as z.ZodDate,
  userId: z.string(),
}).superRefine((data, ctx) => {
  if (data.startDate >= data.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "End date must be after start date",
    });
  }

  const isOddSemester = data.semesterNumber % 2 === 1;
  if (data.type === "odd" && !isOddSemester) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["semesterNumber"],
      message: "Odd type allows only 1, 3, 5, or 7",
    });
  }

  if (data.type === "even" && isOddSemester) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["semesterNumber"],
      message: "Even type allows only 2, 4, 6, or 8",
    });
  }
});

export const CreateSemesterSchema = BaseSemesterSchema;

export const SemesterResponseSchema = BaseSemesterSchema.extend({
  id: z.uuid(),
  name: z.string().nullish(),
  isCurrent: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export const SemesterQuerySchema = SemesterResponseSchema.partial();

export type CreateSemesterType = z.infer<typeof CreateSemesterSchema>;
export type SemesterResponseType = z.infer<typeof SemesterResponseSchema>;
export type SemesterQueryType = z.infer<typeof SemesterQuerySchema>;
