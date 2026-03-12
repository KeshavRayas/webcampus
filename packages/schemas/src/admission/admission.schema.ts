import { z } from "zod";

export const CreateAdmissionShellSchema = z.object({
  applicationId: z.string().min(1, "Application ID is required"),
  modeOfAdmission: z.string().min(1, "Mode of Admission is required"),
  semesterId: z.string().uuid("Invalid Semester ID"),
});

const AdmissionStatusSchema = z.enum([
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
]);

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

export type CreateAdmissionShellType = z.infer<
  typeof CreateAdmissionShellSchema
>;
export type GetAdmissionsQueryType = z.infer<typeof GetAdmissionsQuerySchema>;
