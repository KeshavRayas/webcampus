import { z } from "zod";

export const SemesterTypeSchema = z.enum(["even", "odd", "supplementary"]);
export const TermParitySchema = z.enum(["odd", "even"]);
export const ProgramTypeSchema = z.enum(["UG", "PG"]);
export const SemesterLifecycleStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
]);

const optionalQueryString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

const AcademicTermBaseSchema = z.object({
  type: SemesterTypeSchema,
  parity: TermParitySchema.optional(),
  year: z.string().min(4, { message: "Year is required" }),
  isCurrent: z.boolean().default(false).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const CreateAcademicTermSchema = AcademicTermBaseSchema.superRefine(
  (data, ctx) => {
    if (data.startDate && data.endDate && data.startDate >= data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be after start date",
      });
    }

    if (data.type === "supplementary" && !data.parity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parity"],
        message: "Parity is required for supplementary terms (Odd or Even)",
      });
    }

    if (data.type !== "supplementary" && data.parity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parity"],
        message: "Parity applies only to supplementary terms",
      });
    }
  }
);

// Updates are lenient about parity so legacy supplementary terms (parity
// never set) can still be edited without being forced to declare one.
export const UpdateAcademicTermSchema = AcademicTermBaseSchema.superRefine(
  (data, ctx) => {
    if (data.startDate && data.endDate && data.startDate >= data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be after start date",
      });
    }

    if (data.type !== "supplementary" && data.parity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parity"],
        message: "Parity applies only to supplementary terms",
      });
    }
  }
);

export const BaseSemesterConfigSchema = z.object({
  academicTermId: z.string().uuid(),
  programType: ProgramTypeSchema,
  semesterNumber: z.number().int().min(1).max(8),
  termType: SemesterTypeSchema, // Client passes this so we can validate parity
  startDate: z.coerce.date() as z.ZodDate,
  endDate: z.coerce.date() as z.ZodDate,
  userId: z.string(),
});

export const CreateSemesterConfigSchema = BaseSemesterConfigSchema.omit({
  userId: true,
}).superRefine((data, ctx) => {
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

export const AcademicTermResponseSchema = AcademicTermBaseSchema.extend({
  id: z.string().uuid(),
  parity: TermParitySchema.nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
});

export const CreateSemesterConfigListSchema = z
  .array(CreateSemesterConfigSchema)
  .superRefine((items, ctx) => {
    const suppItems = items.filter((item) => item.termType === "supplementary");
    if (suppItems.length < 2) return;

    const parities = new Set(suppItems.map((item) => item.semesterNumber % 2));
    if (parities.size > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["semesterNumber"],
        message:
          "A supplementary term hosts semesters of a single parity (all odd or all even)",
      });
    }
  });

export const SemesterConfigResponseSchema = BaseSemesterConfigSchema.omit({
  termType: true,
}).extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  status: SemesterLifecycleStatusSchema.optional(),
});

export const AcademicTermQuerySchema = z.object({
  id: optionalQueryString(z.uuid("Invalid term ID")),
  type: optionalQueryString(SemesterTypeSchema),
  year: optionalQueryString(z.string()),
  isCurrent: z
    .preprocess((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      if (value === "") return undefined;
      return value;
    }, z.boolean().optional())
    .optional(),
  status: optionalQueryString(SemesterLifecycleStatusSchema),
});
export const SemesterConfigQuerySchema = SemesterConfigResponseSchema.partial();

export type CreateAcademicTermType = z.infer<typeof CreateAcademicTermSchema>;
export type UpdateAcademicTermType = z.infer<typeof UpdateAcademicTermSchema>;
export type CreateSemesterConfigType = z.infer<
  typeof CreateSemesterConfigSchema
>;
export type SemesterConfigResponseType = z.infer<
  typeof SemesterConfigResponseSchema
>;
export type AcademicTermResponseType = z.infer<
  typeof AcademicTermResponseSchema
> & {
  status?: z.infer<typeof SemesterLifecycleStatusSchema>;
  Semester?: SemesterConfigResponseType[];
};
export type AcademicTermQueryType = z.infer<typeof AcademicTermQuerySchema>;
export type SemesterConfigQueryType = z.infer<typeof SemesterConfigQuerySchema>;
export type SemesterLifecycleStatusType = z.infer<
  typeof SemesterLifecycleStatusSchema
>;
