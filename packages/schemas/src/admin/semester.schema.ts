import { z } from "zod";

export const SemesterTypeSchema = z.enum(["even", "odd"]);
export const ProgramTypeSchema = z.enum(["UG", "PG"]);

export const CreateAcademicTermSchema = z.object({
  type: SemesterTypeSchema,
  year: z.string().min(4, { message: "Year is required" }),
  isCurrent: z.boolean().default(false).optional(),
});

export const BaseSemesterConfigSchema = z
  .object({
    academicTermId: z.string().uuid(),
    programType: ProgramTypeSchema,
    semesterNumber: z.number().int().min(1).max(8),
    termType: SemesterTypeSchema, // Client passes this so we can validate parity
    startDate: z.coerce.date() as z.ZodDate,
    endDate: z.coerce.date() as z.ZodDate,
    userId: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.startDate >= data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be after start date",
      });
    }

    if (
      data.programType === "UG" &&
      (data.semesterNumber < 1 || data.semesterNumber > 8)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["semesterNumber"],
        message: "UG semester number must be between 1 and 8",
      });
    }

    if (
      data.programType === "PG" &&
      (data.semesterNumber < 1 || data.semesterNumber > 4)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["semesterNumber"],
        message: "PG semester number must be between 1 and 4",
      });
    }

    const isOddSemester = data.semesterNumber % 2 === 1;
    if (data.termType === "odd" && !isOddSemester) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["semesterNumber"],
        message: "Odd term allows only 1, 3, 5, or 7",
      });
    }

    if (data.termType === "even" && isOddSemester) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["semesterNumber"],
        message: "Even term allows only 2, 4, 6, or 8",
      });
    }
  });

export const CreateSemesterConfigSchema = BaseSemesterConfigSchema;

export const AcademicTermResponseSchema = CreateAcademicTermSchema.extend({
  id: z.string().uuid(),
});

export const SemesterConfigResponseSchema = BaseSemesterConfigSchema.omit({
  termType: true,
}).extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export const AcademicTermQuerySchema = AcademicTermResponseSchema.partial();
export const SemesterConfigQuerySchema = SemesterConfigResponseSchema.partial();

export type CreateAcademicTermType = z.infer<typeof CreateAcademicTermSchema>;
export type CreateSemesterConfigType = z.infer<
  typeof CreateSemesterConfigSchema
>;
export type SemesterConfigResponseType = z.infer<
  typeof SemesterConfigResponseSchema
>;
export type AcademicTermResponseType = z.infer<
  typeof AcademicTermResponseSchema
> & {
  Semester?: SemesterConfigResponseType[];
};
export type AcademicTermQueryType = z.infer<typeof AcademicTermQuerySchema>;
export type SemesterConfigQueryType = z.infer<typeof SemesterConfigQuerySchema>;
