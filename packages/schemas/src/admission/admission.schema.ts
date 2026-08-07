import { z } from "zod";
import {
  admissionTypes,
  categoriesAllotted,
  categoriesClaimed,
  quotas,
} from "../constants";

const strongString = (min = 1, max?: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max ?? 200);

const optionalText = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().optional());

const phoneSchema = z
  .string()
  .regex(/^\d{10}$/, "Phone number must be 10 digits");
const pincodeSchema = z.string().regex(/^\d{6}$/, "Pincode must be 6 digits");
const aadharSchema = z
  .string()
  .regex(/^\d{12}$/, "Aadhaar number must be 12 digits");

const markValueSchema = z.number().min(0).max(100);

export const AdmissionWizardSchema = z.object({
  application: z.object({
    status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
    quota: z.string().trim().min(1).max(60).optional(),
    branchCode: strongString(1, 20).optional(),
    academicYear: strongString(1, 20).optional(),
  }),
  personalDetails: z.object({
    fullName: strongString(2, 120),
    dob: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD"),
    gender: z.enum(["Male", "Female", "Other", "Prefer not to say"]),
    bloodGroup: z.string().trim().min(1).max(10).optional(),
    aadharNumber: aadharSchema,
    religion: strongString(1, 40).optional(),
    caste: strongString(1, 60).optional(),
    motherTongue: strongString(1, 40).optional(),
    claimedCategory: strongString(1, 40),
    allottedCategory: strongString(1, 40),
  }),
  parentDetails: z.object({
    fatherName: strongString(1, 120),
    fatherOccupation: strongString(1, 100).optional(),
    fatherPhone: phoneSchema.optional(),
    fatherEmail: z.email().optional(),
    motherName: strongString(1, 120),
    motherOccupation: strongString(1, 100).optional(),
    motherPhone: phoneSchema.optional(),
    annualIncome: z.number().min(0).optional(),
  }),
  addressDetails: z.object({
    permanentAddress: strongString(1, 200),
    permanentCity: strongString(1, 80),
    permanentState: strongString(1, 80),
    permanentPincode: pincodeSchema,
    communicationAddress: strongString(1, 200),
    communicationCity: strongString(1, 80),
    communicationState: strongString(1, 80),
    communicationPincode: pincodeSchema,
    isSameAddress: z.boolean().default(false),
  }),
  entranceDetails: z.object({
    entranceType: strongString(1, 40),
    rollNumber: strongString(1, 40),
    rank: z.number().int().min(1).optional(),
    allotmentNumber: strongString(1, 40).optional(),
    admissionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Admission date must be YYYY-MM-DD")
      .optional(),
  }),
  academicDetails: z
    .object({
      tenthBoard: strongString(1, 80),
      tenthRegistrationNumber: strongString(1, 40),
      tenthMaxMarks: z.number().min(0).max(1000).optional(),
      tenthObtainedMarks: z.number().min(0).max(1000).optional(),
      twelfthBoard: strongString(1, 80),
      twelfthRegistrationNumber: strongString(1, 40),
      twelfthMaxMarks: z.number().min(0).max(1000).optional(),
      twelfthObtainedMarks: z.number().min(0).max(1000).optional(),
      physicsMarks: markValueSchema.optional(),
      chemistryMarks: markValueSchema.optional(),
      mathematicsMarks: markValueSchema.optional(),
      pcmPercentage: z.number().min(0).max(100).optional(),
    })
    .superRefine((data, ctx) => {
      const fields = [
        [data.tenthMaxMarks, data.tenthObtainedMarks, "tenth"],
        [data.twelfthMaxMarks, data.twelfthObtainedMarks, "twelfth"],
      ] as const;

      for (const [maxMarks, obtainedMarks, label] of fields) {
        if (maxMarks == null || obtainedMarks == null) continue;
        if (obtainedMarks > maxMarks) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path:
              label === "tenth"
                ? ["tenthObtainedMarks"]
                : ["twelfthObtainedMarks"],
            message: "Obtained marks cannot exceed maximum marks",
          });
        }
      }
    }),
  feeDetails: z.object({
    tuitionFee: z.number().min(0),
    otherFee: z.number().min(0),
    totalAmount: z.number().min(0),
    receiptNumber: strongString(1, 80),
    paymentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date must be YYYY-MM-DD"),
    paymentMode: z.enum(["CASH", "CHEQUE", "ONLINE", "DD"]),
    transactionRef: strongString(1, 80).optional(),
    bankName: strongString(1, 120).optional(),
  }),
  uploadedDocuments: z
    .array(
      z.object({
        documentType: strongString(1, 60),
        fileName: strongString(1, 160),
        fileUrl: z.string().url(),
      })
    )
    .optional(),
  declaration: z.object({
    agreedToTerms: z.boolean(),
    applicantSignature: strongString(1, 120),
    guardianSignature: strongString(1, 120).optional(),
  }),
});

const legacyOptionalText = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().optional());

export const QuotaSchema = z.enum(quotas);

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

export const UpdateAdmissionFeeSchema = z
  .object({
    feePaid: z.coerce.number().min(0, "Fee paid must be a positive amount"),
    feeReceiptNumber: z.string().trim().optional(),
    scholarship: z.boolean().optional(),
    sspId: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scholarship && !data.sspId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sspId"],
        message: "SSP ID is required when scholarship is enabled",
      });
    }
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

export const AdmissionCancellationReasonSchema = z.enum([
  "LEAVE_COLLEGE",
  "CHANGE_ADMISSION_MODE",
  "OTHER",
]);

export const CancelAdmissionSchema = z
  .object({
    reason: AdmissionCancellationReasonSchema,
    otherReason: z.string().trim().max(500).optional(),
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
    applicationId: z.string().min(1, "Application ID is required"),

    firstName: z.string().min(1, "First Name is required"),
    middleName: z.string().optional(),
    lastName: z.string().min(1, "Last Name is required"),

    modeOfAdmission: z.string().min(1, "Mode of Admission is required"),

    semesterId: z.string().uuid("Invalid Semester ID"),
    departmentId: z.string().uuid("Invalid Department ID"),
    admissionType: AdmissionTypeSchema.optional(),
    scholarship: z.enum(["true", "false"]).optional(),
    sspId: z.string().trim().optional(),
    abcAparId: z.string().trim().optional(),
    counsellingRound: z.string().trim().optional(),
    feeReceiptNumber: z.string().trim().optional(),
    studiedKannadaIn10th: z.enum(["true", "false"]).optional(),
    admissionBasedOn: z.enum(["CLASS_12_PUC", "DIPLOMA"]).optional(),
    class10thRollRegNumber: optionalText,
    class12thRollRegNumber: optionalText,
    physicsMarks: optionalText,
    physicsMaxMarks: optionalText,
    physicsMinMarks: optionalText,
    chemistryMarks: optionalText,
    chemistryMaxMarks: optionalText,
    chemistryMinMarks: optionalText,
    mathematicsMarks: optionalText,
    mathematicsMaxMarks: optionalText,
    mathematicsMinMarks: optionalText,
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
    schoolCountry: legacyOptionalText,
    instituteCountry: legacyOptionalText,
    diplomaCountry: legacyOptionalText,
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

export type UpdateAdmissionFeeType = z.infer<typeof UpdateAdmissionFeeSchema>;

export type SubmitApplicationType = z.infer<typeof SubmitApplicationSchema>;

export type PortStudentsType = z.infer<typeof PortStudentsSchema>;

export type ChangeAdmissionModeType = z.infer<typeof ChangeAdmissionModeSchema>;

export type ExitAdmissionType = z.infer<typeof ExitAdmissionSchema>;

export type CancelAdmissionType = z.infer<typeof CancelAdmissionSchema>;
