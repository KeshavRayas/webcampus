import { z } from "zod";

const optionalQueryString = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

export const AdmissionStatusEnum = z.enum([
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
]);

export const DepartmentStudentQuerySchema = z.object({
  usn: optionalQueryString(z.string()),
  name: optionalQueryString(z.string()),
  academicTermId: optionalQueryString(z.string().uuid()),
  programType: optionalQueryString(z.enum(["UG", "PG"])),
  semesterId: optionalQueryString(z.string().uuid()),
  currentSemester: optionalQueryString(z.coerce.number().int().min(1).max(8)),
  academicYear: optionalQueryString(z.string()),
  section: optionalQueryString(z.string()),
});

export const DepartmentStudentResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  usn: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  departmentName: z.string(),
  currentSemester: z.number().int(),
  academicYear: z.string(),
  section: z.string().nullable(),
});

export type DepartmentStudentQueryType = z.infer<
  typeof DepartmentStudentQuerySchema
>;
export type DepartmentStudentResponseType = z.infer<
  typeof DepartmentStudentResponseSchema
>;
