import { z } from "zod";

const COURSE_MODES = [
  "INTEGRATED",
  "NON_INTEGRATED",
  "FINAL_SUMMARY",
  "NCMC",
] as const;
const COURSE_TYPES = ["PC", "PE", "OE", "NCMC"] as const;
const COURSE_CYCLES = ["PHYSICS", "CHEMISTRY", "NONE"] as const;
const OPEN_ELECTIVE_ELIGIBILITIES = [
  "ALL",
  "ALL_EXCEPT_OWNER",
  "CUSTOM",
] as const;

const BaseCourseSchema = z.object({
  code: z
    .string()
    .min(1, "Course code is required")
    .max(20, "Course code must be less than 20 characters"),
  name: z
    .string()
    .min(1, "Course name is required")
    .max(200, "Course name must be less than 200 characters")
    .trim(),
  courseMode: z.enum(COURSE_MODES, { message: "Course mode is required" }),
  courseType: z.enum(COURSE_TYPES, { message: "Course type is required" }),
  cycle: z.enum(COURSE_CYCLES).optional(),
  departmentId: z.string().uuid("Invalid department ID").optional(),
  departmentName: z.string().min(1, "Department is required").optional(),
  semesterId: z.string().min(1, "Semester is required"),
  semesterNumber: z
    .number()
    .int()
    .min(1, "Semester number is required")
    .max(8, "Semester number must be between 1 and 8"),

  // Credit fields (L-T-P-S)
  lectureCredits: z.number().int().min(0).max(10),
  tutorialCredits: z.number().int().min(0).max(10),
  practicalCredits: z.number().int().min(0).max(10),
  skillCredits: z.number().int().min(0).max(10),

  // New Assessment Configuration
  seeMaxMarks: z.number().int().min(0),
  seeEligibility: z.number().int().min(0).max(100).default(40),

  cieMaxMarks: z.number().int().min(0),
  cieEligibility: z.number().int().min(0).max(100).default(40),

  theoryMaxExams: z.number().int().min(0),
  theoryExamMaxMarks: z.number().int().min(0),
  theoryMinExams: z.number().int().min(0),
  theoryCieContribution: z.number().int().min(0),
  theoryEligibility: z.number().int().min(0).max(100).default(40),

  labMaxMarks: z.number().int().min(0),
  labEligibility: z.number().int().min(0).max(100).default(40),

  aatMaxMarks: z.number().int().min(0),
  aatEligibility: z.number().int().min(0).max(100).default(40),

  allowFeedback: z.boolean().default(true),
  attendanceRequired: z.boolean().default(true),

  // Program Elective (PE) batch configuration
  numberOfBatches: z.number().int().min(1).optional(),
  studentsPerBatch: z.number().int().min(1).optional(),
  /** When decreasing numberOfBatches, caller must pick which batch IDs to remove */
  electiveBatchesToRemove: z.array(z.string().uuid()).optional(),

  // Open Elective (OE) visibility configuration
  openElectiveEligibility: z.enum(OPEN_ELECTIVE_ELIGIBILITIES).optional(),
  /** Departments allowed to register when openElectiveEligibility === "CUSTOM" */
  eligibleDepartmentIds: z.array(z.string().uuid()).optional(),
});

const MODE_LOCKED_VALUES = {
  INTEGRATED: { tutorialCredits: 0, skillCredits: 0 },
  NON_INTEGRATED: {
    tutorialCredits: 0,
    practicalCredits: 0,
    skillCredits: 0,
    labMaxMarks: 0,
    labEligibility: 0,
  },
  FINAL_SUMMARY: {
    labMaxMarks: 0,
    labEligibility: 0,
    aatMaxMarks: 0,
    aatEligibility: 0,
  },
  NCMC: {
    lectureCredits: 0,
    tutorialCredits: 0,
    practicalCredits: 0,
    skillCredits: 0,
    seeMaxMarks: 0,
    seeEligibility: 0,
    labMaxMarks: 0,
    labEligibility: 0,
    aatMaxMarks: 0,
    aatEligibility: 0,
  },
} as const;

type ModeName = keyof typeof MODE_LOCKED_VALUES;
type ModeLockedField = keyof (typeof MODE_LOCKED_VALUES)[ModeName];

const addLockedFieldIssue = (
  ctx: z.RefinementCtx,
  field: ModeLockedField,
  expected: number,
  mode: ModeName
) => {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [field],
    message: `${field} must be ${expected} for ${mode} mode`,
  });
};

const validateModeLockedValues = (
  value: Record<string, unknown>,
  mode: ModeName,
  ctx: z.RefinementCtx,
  strictMissing = false
) => {
  const lockedValues = MODE_LOCKED_VALUES[mode];
  (Object.entries(lockedValues) as Array<[ModeLockedField, number]>).forEach(
    ([field, expected]) => {
      const provided = value[field as string];
      if (provided === undefined) {
        if (strictMissing) addLockedFieldIssue(ctx, field, expected, mode);
        return;
      }
      if (typeof provided !== "number" || provided !== expected)
        addLockedFieldIssue(ctx, field, expected, mode);
    }
  );
};

const validateAssessmentBounds = (
  value: Record<string, unknown>,
  ctx: z.RefinementCtx
) => {
  const cieMaxMarks = value.cieMaxMarks as number | undefined;
  const theoryCieContribution = value.theoryCieContribution as
    | number
    | undefined;
  const labMaxMarks = value.labMaxMarks as number | undefined;
  const aatMaxMarks = value.aatMaxMarks as number | undefined;
  const theoryExamMaxMarks = value.theoryExamMaxMarks as number | undefined;
  const theoryMinExams = value.theoryMinExams as number | undefined;
  const theoryMaxExams = value.theoryMaxExams as number | undefined;

  if (
    cieMaxMarks !== undefined &&
    theoryCieContribution !== undefined &&
    labMaxMarks !== undefined &&
    aatMaxMarks !== undefined &&
    theoryCieContribution + labMaxMarks + aatMaxMarks > cieMaxMarks
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["theoryCieContribution"],
      message: "Theory, Lab, and AAT contributions cannot exceed CIE max marks",
    });
  }

  if (
    theoryCieContribution !== undefined &&
    theoryExamMaxMarks !== undefined &&
    theoryMinExams !== undefined &&
    theoryCieContribution > theoryExamMaxMarks * theoryMinExams
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["theoryCieContribution"],
      message:
        "Theory contribution cannot exceed selected Theory exam capacity",
    });
  }

  if (
    theoryMinExams !== undefined &&
    theoryMaxExams !== undefined &&
    theoryMinExams > theoryMaxExams
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["theoryMinExams"],
      message: "Minimum Theory exams cannot exceed the number of Theory exams",
    });
  }
};

const validatePeConfig = (
  value: Record<string, unknown>,
  ctx: z.RefinementCtx,
  strict = true
) => {
  const courseType = value.courseType as string | undefined;
  if (courseType !== "PE") {
    return;
  }

  const courseMode = value.courseMode as string | undefined;
  if (courseMode !== undefined && courseMode !== "NON_INTEGRATED") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["courseMode"],
      message: "Program Elective (PE) courses must use NON_INTEGRATED mode",
    });
  }

  const numberOfBatches = value.numberOfBatches as number | undefined;
  const studentsPerBatch = value.studentsPerBatch as number | undefined;

  if (strict || numberOfBatches !== undefined) {
    if (
      numberOfBatches === undefined ||
      !Number.isInteger(numberOfBatches) ||
      numberOfBatches < 1
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["numberOfBatches"],
        message: "Number of batches is required for PE and must be at least 1",
      });
    }
  }

  if (strict || studentsPerBatch !== undefined) {
    if (
      studentsPerBatch === undefined ||
      !Number.isInteger(studentsPerBatch) ||
      studentsPerBatch < 1
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentsPerBatch"],
        message: "Students per batch is required for PE and must be at least 1",
      });
    }
  }
};

const validateOeConfig = (
  value: Record<string, unknown>,
  ctx: z.RefinementCtx,
  strict = true
) => {
  const courseType = value.courseType as string | undefined;
  if (courseType !== "OE") {
    return;
  }

  const courseMode = value.courseMode as string | undefined;
  if (courseMode !== undefined && courseMode !== "NON_INTEGRATED") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["courseMode"],
      message: "Open Elective (OE) courses must use NON_INTEGRATED mode",
    });
  }

  const numberOfBatches = value.numberOfBatches as number | undefined;
  const studentsPerBatch = value.studentsPerBatch as number | undefined;

  if (strict || numberOfBatches !== undefined) {
    if (
      numberOfBatches === undefined ||
      !Number.isInteger(numberOfBatches) ||
      numberOfBatches < 1
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["numberOfBatches"],
        message: "Number of batches is required for OE and must be at least 1",
      });
    }
  }

  if (strict || studentsPerBatch !== undefined) {
    if (
      studentsPerBatch === undefined ||
      !Number.isInteger(studentsPerBatch) ||
      studentsPerBatch < 1
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentsPerBatch"],
        message: "Students per batch is required for OE and must be at least 1",
      });
    }
  }

  const eligibility = value.openElectiveEligibility as string | undefined;
  const eligibleDepartmentIds = value.eligibleDepartmentIds as
    | string[]
    | undefined;
  if (eligibility === "CUSTOM") {
    if (
      !Array.isArray(eligibleDepartmentIds) ||
      eligibleDepartmentIds.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eligibleDepartmentIds"],
        message:
          "At least one department is required when eligibility is CUSTOM",
      });
    }
  }
};

export const CreateCourseSchema = BaseCourseSchema.superRefine((value, ctx) => {
  if (!value.departmentId && !value.departmentName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["departmentId"],
      message: "departmentId or departmentName is required",
    });
  }
  validateModeLockedValues(
    value as unknown as Record<string, unknown>,
    value.courseMode,
    ctx,
    true
  );
  validateAssessmentBounds(value as unknown as Record<string, unknown>, ctx);
  validatePeConfig(value as unknown as Record<string, unknown>, ctx, true);
  validateOeConfig(value as unknown as Record<string, unknown>, ctx, true);
});

export const UpdateCourseSchema = BaseCourseSchema.partial()
  .extend({
    id: z.string().uuid("Course ID is required for updates"),
  })
  .superRefine((value, ctx) => {
    if (value.courseMode) {
      validateModeLockedValues(
        value as unknown as Record<string, unknown>,
        value.courseMode,
        ctx,
        false
      );
    }
    validateAssessmentBounds(value as unknown as Record<string, unknown>, ctx);
    if (value.courseType === "PE" || value.numberOfBatches !== undefined) {
      validatePeConfig(value as unknown as Record<string, unknown>, ctx, false);
    }
    if (value.courseType === "OE" || value.numberOfBatches !== undefined) {
      validateOeConfig(value as unknown as Record<string, unknown>, ctx, false);
    }
  });

export const DeleteCourseSchema = z.object({
  id: z.string().uuid("Course ID is required"),
});

const ApprovalScopeSchema = z.object({
  semesterId: z.string().uuid("Invalid semester ID"),
  departmentId: z.string().uuid("Invalid department ID").optional(),
  departmentName: z.string().min(1, "Department is required").optional(),
  cycle: z
    .enum(COURSE_CYCLES)
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

const requireDepartmentScope = <
  T extends { departmentId?: string; departmentName?: string },
>(
  value: T,
  ctx: z.RefinementCtx
) => {
  if (!value.departmentId && !value.departmentName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["departmentId"],
      message: "departmentId or departmentName is required",
    });
  }
};

export const ApproveSemesterCoursesSchema = ApprovalScopeSchema.superRefine(
  (value, ctx) => {
    requireDepartmentScope(value, ctx);
  }
);
export const RequestRevisionForSemesterSchema = ApprovalScopeSchema.extend({
  reviewerNotes: z.string().trim().min(1, "Revision notes are required"),
}).superRefine((value, ctx) => {
  requireDepartmentScope(value, ctx);
});
export const CourseBranchQuerySchema = z.object({
  semesterId: z.string().uuid("Invalid semester ID").optional(),
  cycle: z
    .enum(COURSE_CYCLES)
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export const PeCapacitySummaryQuerySchema = z.object({
  semesterId: z.string().uuid("Invalid semester ID"),
  cycle: z
    .enum(COURSE_CYCLES)
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export const PeCapacitySummaryResponseSchema = z.object({
  eligibleStudents: z.number().int(),
  configuredCapacity: z.number().int(),
  remainingSeats: z.number().int(),
});
/**
 * Response schema for a single course (includes backend-computed fields)
 */
export const CourseResponseSchema = BaseCourseSchema.extend({
  id: z.string().uuid(),
  departmentId: z.string().uuid("Invalid department ID"),
  departmentName: z.string().nullable().optional(),
  totalCredits: z.number().int(),
  hasLaboratoryComponent: z.boolean(),
  coordinatorCount: z.number().int().optional(),
  semester: z
    .object({
      programType: z.string(),
      semesterNumber: z.number(),
      academicTerm: z
        .object({
          type: z.string(),
          year: z.string(),
        })
        .optional(),
    })
    .optional(),
  isFullyMapped: z.boolean().optional(),
  isPartiallyMapped: z.boolean().optional(),
  isUnmapped: z.boolean().optional(),
  approvalStatus: z.string().optional(),
  approvedByRole: z.string().nullable().optional(),
  approvedByUsername: z.string().nullable().optional(),
  approvedByDisplay: z.string().nullable().optional(),
  approvedAt: z.string().nullable().optional(),
  revisionRequestedByRole: z.string().nullable().optional(),
  revisionNotes: z.string().nullable().optional(),
  revisionRequestedAt: z.string().nullable().optional(),
  version: z.number().int().optional(),
  lastOverrideAt: z.string().nullable().optional(),
  lastOverrideById: z.string().nullable().optional(),
  overrideCount: z.number().int().optional(),
  hasPostApprovalEdits: z.boolean().optional(),
  numberOfBatches: z.number().int().nullable().optional(),
  studentsPerBatch: z.number().int().nullable().optional(),
  electiveMappingVersion: z.number().int().optional(),
  openElectiveEligibility: z.enum(OPEN_ELECTIVE_ELIGIBILITIES).optional(),
  eligibleDepartmentIds: z.array(z.string().uuid()).optional(),
  eligibleDepartments: z
    .array(z.object({ id: z.string().uuid(), name: z.string() }))
    .optional(),
  facultyMappingComplete: z.boolean().optional(),
  electiveMappingComplete: z.boolean().optional(),
  electiveBatches: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        sortOrder: z.number().int(),
        facultyId: z.string().uuid().nullable().optional(),
        facultyName: z.string().nullable().optional(),
        studentCount: z.number().int().optional(),
      })
    )
    .optional(),
});

export type CreateCourseDTO = z.infer<typeof CreateCourseSchema>;
export type UpdateCourseDTO = z.infer<typeof UpdateCourseSchema>;
export type DeleteCourseDTO = z.infer<typeof DeleteCourseSchema>;
export type CourseBranchQueryType = z.infer<typeof CourseBranchQuerySchema>;
export type PeCapacitySummaryQueryType = z.infer<
  typeof PeCapacitySummaryQuerySchema
>;
export type PeCapacitySummaryResponseDTO = z.infer<
  typeof PeCapacitySummaryResponseSchema
>;
export type CourseResponseDTO = z.infer<typeof CourseResponseSchema>;
