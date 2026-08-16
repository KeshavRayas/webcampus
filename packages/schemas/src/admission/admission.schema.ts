import { z } from "zod";
import {
  admissionTypes,
  allQuotas,
  categoriesAllotted,
  categoriesClaimed,
  counsellingRounds,
  nationalities,
} from "../constants";

export const QuotaSchema = z.enum(allQuotas as [string, ...string[]]);

export const CounsellingRoundSchema = z.enum(counsellingRounds);

export const NationalitySchema = z.enum(nationalities);

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
  "CANCELLED",
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

const admissionQueryFields = {
  applicationId: optionalQueryString(z.string()),
  status: optionalQueryString(z.string()),
  feeStatus: optionalQueryString(z.string()),
  mode: optionalQueryString(z.string()),
  admissionType: optionalQueryString(z.string()),
  admissionBasedOn: optionalQueryString(z.string()),
  department: optionalQueryString(z.string()),
  categoryClaimed: optionalQueryString(z.string()),
  categoryAllotted: optionalQueryString(z.string()),
  quota: optionalQueryString(z.string()),
  hostel: optionalQueryString(z.string()),
  round: optionalQueryString(z.string()),
  cancellationStatus: optionalQueryString(z.string()),
  cancellationReason: optionalQueryString(z.string()),
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
};

const validateAdmissionDateRange = (data: {
  createdFrom?: string;
  createdTo?: string;
}) => {
  if (!data.createdFrom || !data.createdTo) return true;
  return new Date(data.createdFrom) <= new Date(data.createdTo);
};

export const GetAdmissionsQuerySchema = z
  .object(admissionQueryFields)
  .refine(validateAdmissionDateRange, {
    message: "Created from date must be before created to date",
    path: ["createdFrom"],
  });

export const GetAdmissionReportsQuerySchema = z
  .object({
    ...admissionQueryFields,
    search: optionalQueryString(z.string()),
    page: optionalQueryString(z.string()),
    pageSize: optionalQueryString(z.string()),
  })
  .refine(validateAdmissionDateRange, {
    message: "Created from date must be before created to date",
    path: ["createdFrom"],
  });

export const ExitAdmissionSchema = z.object({});

export const AdmissionReferenceListsSchema = z.object({
  quotas: z
    .array(z.string().trim().min(1))
    .min(1, "At least one quota is required"),
  categoriesClaimed: z
    .array(z.string().trim().min(1))
    .min(1, "At least one category is required"),
  categoriesAllotted: z
    .array(z.string().trim().min(1))
    .min(1, "At least one allotted category is required"),
});

export const AdmissionReferenceCreateSchema =
  AdmissionReferenceListsSchema.extend({
    modeOfAdmission: z
      .string()
      .trim()
      .min(1, "Mode of admission is required")
      .max(100),
  });

export const AdmissionReferenceModeParamSchema = z.object({
  mode: z.string().min(1).max(100),
});

export const AdmissionCancellationReasonSchema = z.enum([
  "LEAVE_COLLEGE",
  "CHANGE_ADMISSION_MODE",
  "OTHER",
]);

export const CancelAdmissionSchema = z
  .object({
    reason: AdmissionCancellationReasonSchema,
    otherReason: z.string().trim().max(500).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.reason === "OTHER" && !data.otherReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["otherReason"],
        message: "A reason is required when Other is selected",
      });
    }
  });

export const SubmitApplicationSchema = z
  .object({
    applicationId: z.string().trim().optional(),

    nameAsPer10th: z.string().min(1, "Name as per 10th grade is required"),

    modeOfAdmission: z.string().min(1, "Mode of Admission is required"),

    semesterId: z.string().uuid("Invalid Semester ID"),
    departmentId: z.string().uuid("Invalid Department ID"),
    admissionType: AdmissionTypeSchema,
    scholarship: z.enum(["true", "false"]),
    sspId: z.string().trim().optional(),
    abcAparId: z.string().regex(/^\d{12}$/, "ABC/APAAR ID must be 12 digits"),
    counsellingRound: CounsellingRoundSchema,
    feeReceiptNumber: z.string().trim().optional(),
    feePaid: optionalText,
    studiedKannadaIn10th: z.enum(["true", "false"]),
    admissionBasedOn: z.enum(["CLASS_12_PUC", "DIPLOMA"]),
    class10thRollRegNumber: z
      .string()
      .min(1, "Roll/Registration Number is required"),
    class12thRollRegNumber: z
      .string()
      .min(1, "Roll/Registration Number is required"),
    physicsMarks: optionalText,
    physicsMaxMarks: optionalText,
    chemistryMarks: optionalText,
    chemistryMaxMarks: optionalText,
    mathematicsMarks: optionalText,
    mathematicsMaxMarks: optionalText,
    passportNumber: z.string().trim().optional(),
    passportExpiryDate: z.string().optional(),
    visaNumber: z.string().trim().optional(),
    visaExpiryDate: z.string().optional(),
    parentPassportNumber: z.string().trim().optional(),
    parentVisaNumber: z.string().trim().optional(),
    parentVisaExpiryDate: z.string().optional(),
    nationality: NationalitySchema,

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
export type GetAdmissionReportsQueryType = z.infer<
  typeof GetAdmissionReportsQuerySchema
>;

export type AdmissionActionParamType = z.infer<
  typeof AdmissionActionParamSchema
>;

export const ApproveAdmissionSchema = z.object({
  feePaid: z.coerce.number().nonnegative().optional(),
  feeReceiptNumber: z.string().trim().max(100).optional(),
});

export type SubmitApplicationType = z.infer<typeof SubmitApplicationSchema>;

export type PortStudentsType = z.infer<typeof PortStudentsSchema>;

export type ChangeAdmissionModeType = z.infer<typeof ChangeAdmissionModeSchema>;

export type ExitAdmissionType = z.infer<typeof ExitAdmissionSchema>;

export type CancelAdmissionType = z.infer<typeof CancelAdmissionSchema>;
