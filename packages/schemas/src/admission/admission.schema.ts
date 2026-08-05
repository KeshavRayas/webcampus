import { z } from "zod";
import {
  admissionTypes,
  categoriesAllotted,
  categoriesClaimed,
  quotas,
} from "../constants";

export const QuotaSchema = z.enum(quotas);

const optionalText = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().optional());

export const CreateAdmissionShellSchema = z.object({
  primaryEmail: z.email().min(1, "Email is required"),
  password: z.string().min(8),
  semesterId: z.string().uuid("Invalid semester ID"),
  departmentId: z.string().uuid("Invalid department ID"),
});

export const AdmissionStatusSchema = z.enum([
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "EXITED",
]);

export const AdmissionTypeSchema = z.enum(
  admissionTypes.map((type) => type.value) as [string, ...string[]]
);

export const AdmissionActionParamSchema = z.object({
  id: z.string().uuid("Invalid admission ID"),
});

export const PortStudentsSchema = z.object({
  semesterId: z.string().uuid("Invalid semester ID"),
});

export const ChangeAdmissionModeSchema = z
  .object({
    modeOfAdmission: z.string().min(1, "Mode of Admission is required"),

    categoryClaimed: z.string().min(1, "Category Claimed is required"),

    categoryAllotted: z.string().min(1, "Category Allotted is required"),

    quota: QuotaSchema.optional(),

    entranceExamRank: z.coerce.number().nullable().optional(),

    originalAdmissionOrderNumber: z.string().trim().optional(),

    originalAdmissionOrderDate: z.iso.date().optional(),
  })
  .superRefine((data, ctx) => {
    const claimed =
      categoriesClaimed[data.modeOfAdmission as keyof typeof categoriesClaimed];

    if (!claimed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["modeOfAdmission"],
        message: "Invalid admission mode",
      });
      return;
    }

    if (!claimed.includes(data.categoryClaimed as never)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryClaimed"],
        message: "Invalid claimed category",
      });
    }

    const allotted =
      categoriesAllotted[
        data.modeOfAdmission as keyof typeof categoriesAllotted
      ];

    if (allotted && !allotted.includes(data.categoryAllotted as never)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryAllotted"],
        message: "Invalid allotted category",
      });
    }

    if (data.modeOfAdmission === "KCET" && !data.quota) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quota"],
        message: "Quota is required for KCET admissions",
      });
    }
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
    admissionType: optionalQueryString(AdmissionTypeSchema),
    semester: optionalQueryString(z.string().uuid("Invalid semester")),
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

export const ExitAdmissionSchema = z.object({});

export const SubmitApplicationSchema = z
  .object({
    applicationId: z.string().min(1, "Application ID is required"),

    firstName: z.string().min(1, "First Name is required"),
    middleName: z.string().optional(),
    lastName: z.string().min(1, "Last Name is required"),

    modeOfAdmission: z.string().min(1, "Mode of Admission is required"),

    semesterId: z.string().uuid("Invalid Semester ID"),
    departmentId: z.string().uuid("Invalid Department ID"),
    admissionType: AdmissionTypeSchema,
    scholarship: z.enum(["true", "false"]),
    sspId: z.string().trim().optional(),
    abcAparId: z.string().trim().optional(),
    counsellingRound: z.string().trim().optional(),
    feeReceiptNumber: z.string().trim().optional(),
    studiedKannadaIn10th: z.enum(["true", "false"]),
    passportNumber: z.string().trim().optional(),
    passportExpiryDate: z.string().optional(),
    visaNumber: z.string().trim().optional(),
    visaExpiryDate: z.string().optional(),
    parentPassportNumber: z.string().trim().optional(),
    parentVisaNumber: z.string().trim().optional(),
    parentVisaExpiryDate: z.string().optional(),

    categoryClaimed: z.string().min(1, "Category Claimed is required"),
    categoryAllotted: z.string().min(1, "Category Allotted is required"),

    quota: QuotaSchema.optional(),
    schoolCountry: optionalText,
    instituteCountry: optionalText,
    diplomaCountry: optionalText,
  })
  .superRefine((data, ctx) => {
    if (data.scholarship === "true" && !data.sspId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sspId"],
        message: "SSP ID is required when scholarship is enabled",
      });
    }

    const claimed =
      categoriesClaimed[data.modeOfAdmission as keyof typeof categoriesClaimed];

    if (!claimed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["modeOfAdmission"],
        message: "Invalid admission mode",
      });
      return;
    }

    if (!claimed.includes(data.categoryClaimed as never)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryClaimed"],
        message: "Invalid claimed category",
      });
    }

    const allotted =
      categoriesAllotted[
        data.modeOfAdmission as keyof typeof categoriesAllotted
      ];

    if (allotted && !allotted.includes(data.categoryAllotted as never)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryAllotted"],
        message: "Invalid allotted category",
      });
    }

    if (data.modeOfAdmission === "KCET" && !data.quota) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quota"],
        message: "Quota is required for KCET admissions",
      });
    }
  });

export type CreateAdmissionShellType = z.infer<
  typeof CreateAdmissionShellSchema
>;

export type GetAdmissionsQueryType = z.infer<typeof GetAdmissionsQuerySchema>;

export type AdmissionActionParamType = z.infer<
  typeof AdmissionActionParamSchema
>;

export type SubmitApplicationType = z.infer<typeof SubmitApplicationSchema>;

export type PortStudentsType = z.infer<typeof PortStudentsSchema>;

export type ChangeAdmissionModeType = z.infer<typeof ChangeAdmissionModeSchema>;

export type ExitAdmissionType = z.infer<typeof ExitAdmissionSchema>;
