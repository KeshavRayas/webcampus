import { z } from "zod";

const optionalQueryString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

export const GetExamRegistrationsQuerySchema = z.object({
  academicTermId: z.uuid("Invalid academic term ID"),
  courseId: optionalQueryString(z.uuid("Invalid course ID")),
  examType: optionalQueryString(
    z.enum(["REGULAR", "REAPPEAR", "SUPPLEMENTARY", "MAKE_UP"])
  ),
  status: optionalQueryString(
    z.enum(["REGISTERED", "SEATED", "RESULT_DECLARED", "CANCELLED"])
  ),
  page: optionalQueryString(z.coerce.number().int().positive().default(1)),
  pageSize: optionalQueryString(
    z.coerce.number().int().positive().max(100).default(20)
  ),
});

export type GetExamRegistrationsQueryType = z.infer<
  typeof GetExamRegistrationsQuerySchema
>;
