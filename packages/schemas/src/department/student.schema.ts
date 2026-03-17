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
  tempUsn: optionalQueryString(z.string()),
  name: optionalQueryString(z.string()),
  status: optionalQueryString(AdmissionStatusEnum),
  modeOfAdmission: optionalQueryString(z.string()),
  gender: optionalQueryString(z.string()),
});

export const DepartmentStudentResponseSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  tempUsn: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  branch: z.string().nullable(),
  status: AdmissionStatusEnum,
  modeOfAdmission: z.string(),
  gender: z.string().nullable(),
  primaryEmail: z.string().nullable(),
  createdAt: z.date(),
});

export type DepartmentStudentQueryType = z.infer<
  typeof DepartmentStudentQuerySchema
>;
export type DepartmentStudentResponseType = z.infer<
  typeof DepartmentStudentResponseSchema
>;
