import { z } from "zod";

export const CreateAdmissionShellSchema = z.object({
  applicationId: z.string().min(1, "Application ID is required"),
  modeOfAdmission: z.string().min(1, "Mode of Admission is required"),
  semesterId: z.string().uuid("Invalid Semester ID"),
});

export const AdmissionStatusSchema = z.enum([
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
]);

export const AdmissionActionParamSchema = z.object({
  id: z.string().uuid("Invalid admission ID"),
});

export const PortStudentsSchema = z.object({
  semesterId: z.string().uuid("Invalid semester ID"),
});

const optionalQueryString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

export const GetAdmissionsQuerySchema = z
  .object({
    applicationId: optionalQueryString(z.string()),
    status: optionalQueryString(AdmissionStatusSchema),
    mode: optionalQueryString(z.string()),
    semester: optionalQueryString(z.uuid("Invalid semester")),
    createdFrom: optionalQueryString(
      z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "Invalid created from date",
      })
    ),
    createdTo: optionalQueryString(
      z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "Invalid created to date",
      })
    ),
  })
  .refine(
    (data) => {
      if (!data.createdFrom || !data.createdTo) return true;
      return new Date(data.createdFrom) <= new Date(data.createdTo);
    },
    {
      message: "Created from date must be before created to date",
      path: ["createdFrom"],
    }
  );

export const SubmitApplicationSchema = z.object({
  departmentId: z.string().uuid("Invalid department ID"),
});
export type CreateAdmissionShellType = z.infer<
  typeof CreateAdmissionShellSchema
>;
export type GetAdmissionsQueryType = z.infer<typeof GetAdmissionsQuerySchema>;
export type AdmissionActionParamType = z.infer<
  typeof AdmissionActionParamSchema
>;
export type PortStudentsType = z.infer<typeof PortStudentsSchema>;
