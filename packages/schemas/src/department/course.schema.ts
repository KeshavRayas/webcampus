import { z } from "zod";

/**
 * Enum values matching Prisma CourseMode
 */
const COURSE_MODES = [
  "INTEGRATED",
  "NON_INTEGRATED",
  "FINAL_SUMMARY",
  "NCMC",
] as const;

/**
 * Enum values matching Prisma CourseType
 */
const COURSE_TYPES = ["PC", "PE", "OE", "NCMC"] as const;

/**
 * Enum values matching Prisma Cycle
 */
const COURSE_CYCLES = ["PHYSICS", "CHEMISTRY", "NONE"] as const;

/**
 * Base course schema with all user-provided fields.
 * Excludes backend-computed fields: totalCredits, hasLaboratoryComponent
 */
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

  courseMode: z.enum(COURSE_MODES, {
    message: "Course mode is required",
  }),

  courseType: z.enum(COURSE_TYPES, {
    message: "Course type is required",
  }),

  cycle: z.enum(COURSE_CYCLES).optional(),

  departmentName: z.string().min(1, "Department is required"),

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

  // SEE Assessment
  seeMaxMarks: z.number().int().min(0),
  seeMinMarks: z.number().int().min(0),
  seeWeightage: z.number().int().min(0),

  // CIE Assessment
  maxNoOfCies: z.number().int().min(0),
  minNoOfCies: z.number().int().min(0),
  cieMaxMarks: z.number().int().min(0),
  cieMinMarks: z.number().int().min(0),
  cieWeightage: z.number().int().min(0),

  // Other Assessment
  noOfAssignments: z.number().int().min(0),
  assignmentMaxMarks: z.number().int().min(0),
  labMaxMarks: z.number().int().min(0),
  labMinMarks: z.number().int().min(0),
  labWeightage: z.number().int().min(0),
  cumulativeMaxMarks: z.number().int().min(0),
  cumulativeMinMarks: z.number().int().min(0),
});

const MODE_LOCKED_VALUES = {
  INTEGRATED: {
    tutorialCredits: 0,
    skillCredits: 0,
    maxNoOfCies: 3,
    minNoOfCies: 2,
    cieMaxMarks: 40,
    cieMinMarks: 0,
    cieWeightage: 50,
    assignmentMaxMarks: 5,
    labMaxMarks: 25,
    labMinMarks: 10,
    labWeightage: 0,
    cumulativeMaxMarks: 100,
    cumulativeMinMarks: 40,
  },
  NON_INTEGRATED: {
    tutorialCredits: 0,
    practicalCredits: 0,
    skillCredits: 0,
    maxNoOfCies: 3,
    minNoOfCies: 2,
    cieMaxMarks: 40,
    cieMinMarks: 0,
    cieWeightage: 100,
    assignmentMaxMarks: 10,
    labMaxMarks: 0,
    labMinMarks: 0,
    labWeightage: 0,
    cumulativeMaxMarks: 100,
    cumulativeMinMarks: 40,
  },
  FINAL_SUMMARY: {
    tutorialCredits: 0,
    practicalCredits: 0,
    skillCredits: 0,
    maxNoOfCies: 3,
    minNoOfCies: 2,
    cieMaxMarks: 50,
    cieMinMarks: 20,
    cieWeightage: 100,
    noOfAssignments: 0,
    assignmentMaxMarks: 0,
    labMaxMarks: 0,
    labMinMarks: 0,
    labWeightage: 0,
    cumulativeMaxMarks: 100,
    cumulativeMinMarks: 40,
  },
  NCMC: {
    tutorialCredits: 0,
    practicalCredits: 0,
    skillCredits: 0,
    seeMaxMarks: 0,
    seeMinMarks: 0,
    seeWeightage: 0,
    maxNoOfCies: 0,
    minNoOfCies: 0,
    cieMaxMarks: 0,
    cieMinMarks: 0,
    cieWeightage: 0,
    noOfAssignments: 0,
    assignmentMaxMarks: 0,
    labMaxMarks: 0,
    labMinMarks: 0,
    labWeightage: 0,
    cumulativeMaxMarks: 100,
    cumulativeMinMarks: 40,
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
        if (strictMissing) {
          addLockedFieldIssue(ctx, field, expected, mode);
        }
        return;
      }

      if (typeof provided !== "number" || provided !== expected) {
        addLockedFieldIssue(ctx, field, expected, mode);
      }
    }
  );
};

/**
 * Schema for creating a new course
 */
export const CreateCourseSchema = BaseCourseSchema.superRefine((value, ctx) => {
  validateModeLockedValues(
    value as unknown as Record<string, unknown>,
    value.courseMode,
    ctx,
    true
  );
});

/**
 * Schema for updating an existing course.
 * Requires `id`; all other fields are optional for partial updates.
 */
export const UpdateCourseSchema = BaseCourseSchema.partial()
  .extend({
    id: z.string().uuid("Course ID is required for updates"),
  })
  .superRefine((value, ctx) => {
    if (!value.courseMode) return;
    validateModeLockedValues(
      value as unknown as Record<string, unknown>,
      value.courseMode,
      ctx,
      false
    );
  });

/**
 * Schema for deleting a course
 */
export const DeleteCourseSchema = z.object({
  id: z.string().uuid("Course ID is required"),
});

/**
 * Response schema for a single course (includes backend-computed fields)
 */
export const CourseResponseSchema = BaseCourseSchema.extend({
  id: z.string().uuid(),
  totalCredits: z.number().int(),
  hasLaboratoryComponent: z.boolean(),
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
});

export type CreateCourseDTO = z.infer<typeof CreateCourseSchema>;
export type UpdateCourseDTO = z.infer<typeof UpdateCourseSchema>;
export type DeleteCourseDTO = z.infer<typeof DeleteCourseSchema>;
export type CourseResponseDTO = z.infer<typeof CourseResponseSchema>;
