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
  departmentId: optionalQueryString(z.string().uuid()),
  academicTermId: optionalQueryString(z.string().uuid()),
  semesterId: optionalQueryString(z.string().uuid()),
  academicYear: optionalQueryString(z.string()),
  programType: optionalQueryString(z.enum(["UG", "PG"])),
  currentSemester: optionalQueryString(
    z.coerce.number().int().min(1).max(8)
  ),
});

export const AdminStudentResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  usn: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  departmentId: z.string().nullable().optional(),
  departmentName: z.string(),
  currentSemester: z.number().int(),
  academicYear: z.string(),
  semesterId: z.string().nullable().optional(),
  programType: z.enum(["UG", "PG"]).nullable().optional(),
  academicTermId: z.string().nullable().optional(),
  academicTermType: z.enum(["even", "odd"]).nullable().optional(),
  academicTermYear: z.string().nullable().optional(),
  academicTermLabel: z.string().nullable().optional(),
});

export type GetAdminStudentsQueryType = z.infer<
  typeof GetAdminStudentsQuerySchema
>;
export type AdminStudentResponseType = z.infer<
  typeof AdminStudentResponseSchema
>;
