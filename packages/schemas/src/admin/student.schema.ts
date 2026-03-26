import { z } from "zod";

const optionalQueryString = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

export const GetAdminStudentsQuerySchema = z.object({
  name: optionalQueryString(z.string()),
  usn: optionalQueryString(z.string()),
  email: optionalQueryString(z.string()),
  departmentName: optionalQueryString(z.string()),
  currentSemester: optionalQueryString(z.coerce.number().int().min(1).max(8)),
});

export const AdminStudentResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  usn: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  departmentName: z.string(),
  currentSemester: z.number().int(),
  academicYear: z.string(),
});

export type GetAdminStudentsQueryType = z.infer<
  typeof GetAdminStudentsQuerySchema
>;
export type AdminStudentResponseType = z.infer<
  typeof AdminStudentResponseSchema
>;
