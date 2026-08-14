import { z } from "zod";

export const assignmentTypeEnum = z.enum(["THEORY", "LAB"]);

export const BaseCourseAssignmentSchema = z
  .object({
    courseId: z.uuid("Invalid course ID"),
    facultyId: z.uuid("Invalid faculty ID"),
    sectionId: z.uuid("Invalid section ID"),
    batchId: z.uuid("Invalid batch ID").nullable().optional(),
    assignmentType: assignmentTypeEnum,
    semester: z.number().int().positive("Semester must be a positive integer"),
    academicYear: z.string().min(1, "Academic year is required"),
  })
  .superRefine((value, ctx) => {
    if (value.assignmentType === "LAB" && !value.batchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["batchId"],
        message: "batchId is required for LAB assignments",
      });
    }

    if (value.assignmentType === "THEORY" && value.batchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["batchId"],
        message: "batchId must be null for THEORY assignments",
      });
    }
  });

export const CreateCourseAssignmentSchema = BaseCourseAssignmentSchema;

export const CourseAssignmentResponseSchema = BaseCourseAssignmentSchema.extend(
  {
    id: z.uuid("Invalid course assignment ID"),
  }
);

export const CourseMappingStatusQuerySchema = z.object({
  semesterId: z.uuid("Invalid semester ID"),
  academicYear: z.string().min(1, "Academic year is required"),
  cycle: z
    .enum(["PHYSICS", "CHEMISTRY"])
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

export const CourseMappingByCourseQuerySchema = z.object({
  courseId: z.uuid("Invalid course ID"),
  semesterId: z.uuid("Invalid semester ID"),
  academicYear: z.string().min(1, "Academic year is required"),
});

export const CourseMappingFacultyQuerySchema = z.object({});

export const CourseMappingSectionsQuerySchema = z.object({
  semesterId: z.uuid("Invalid semester ID"),
  cycle: z
    .enum(["PHYSICS", "CHEMISTRY", "NONE"])
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export const CourseMappingSectionSchema = z.object({
  sectionId: z.uuid("Invalid section ID"),
  theoryFacultyId: z.uuid("Invalid faculty ID").nullable().optional(),
  labFacultyByBatch: z
    .array(
      z.object({
        batchName: z
          .string()
          .min(1, "Batch name is required")
          .max(20, "Batch name is too long"),
        facultyId: z.uuid("Invalid faculty ID"),
      })
    )
    .optional()
    .default([]),
});

export const UpsertCourseMappingSchema = z
  .object({
    courseId: z.uuid("Invalid course ID"),
    semesterId: z.uuid("Invalid semester ID"),
    academicYear: z.string().min(1, "Academic year is required"),
    studentsPerLabBatch: z.number().int().min(1).optional(),
    sectionMappings: z
      .array(CourseMappingSectionSchema)
      .min(1, "At least one section mapping is required")
      .optional(),
    electiveBatchMappings: z
      .array(
        z.object({
          electiveBatchId: z.uuid("Invalid elective batch ID"),
          facultyId: z.uuid("Invalid faculty ID").nullable(),
        })
      )
      .optional(),
    isSuperEdit: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const hasSections = (value.sectionMappings?.length ?? 0) > 0;
    const hasElective = (value.electiveBatchMappings?.length ?? 0) > 0;
    if (!hasSections && !hasElective) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sectionMappings"],
        message: "At least one section or elective batch mapping is required",
      });
    }
  });

export const CourseMappingStatusItemSchema = z.object({
  courseId: z.uuid(),
  code: z.string(),
  name: z.string(),
  courseMode: z.string(),
  courseType: z.string(),
  cycle: z.string(),
  lectureCredits: z.number().int(),
  tutorialCredits: z.number().int(),
  practicalCredits: z.number().int(),
  assignments: z.array(
    z.object({
      id: z.uuid(),
    })
  ),
  status: z.enum(["Mapped", "Unmapped"]),
});

export const CourseMappingStatusResponseSchema = z.object({
  departmentId: z.uuid(),
  departmentName: z.string(),
  courses: z.array(CourseMappingStatusItemSchema),
});

export const CourseMappingByCourseItemSchema = z.object({
  id: z.uuid(),
  sectionId: z.uuid().nullable().optional(),
  facultyId: z.uuid(),
  assignmentType: assignmentTypeEnum,
  batchId: z.uuid().nullable(),
  batchName: z.string().nullable(),
  facultyName: z.string().nullable(),
  sectionName: z.string().nullable(),
  electiveBatchId: z.uuid().nullable().optional(),
  electiveBatchName: z.string().nullable().optional(),
  proposedFacultyId: z.uuid().nullable().optional(),
});

export const DownloadMappingTemplateQuerySchema = z.object({
  courseId: z.uuid("Invalid course ID"),
  semesterId: z.uuid("Invalid semester ID"),
  academicYear: z.string().min(1, "Academic year is required"),
});

export type DownloadMappingTemplateQueryType = z.infer<
  typeof DownloadMappingTemplateQuerySchema
>;

export type BaseCourseAssignmentType = z.infer<
  typeof BaseCourseAssignmentSchema
>;
export type CreateCourseAssignmentType = z.infer<
  typeof CreateCourseAssignmentSchema
>;
export type CourseAssignmentResponseType = z.infer<
  typeof CourseAssignmentResponseSchema
>;
export type CourseMappingStatusQueryType = z.infer<
  typeof CourseMappingStatusQuerySchema
>;
export type CourseMappingByCourseQueryType = z.infer<
  typeof CourseMappingByCourseQuerySchema
>;
export type CourseMappingFacultyQueryType = z.infer<
  typeof CourseMappingFacultyQuerySchema
>;
export type CourseMappingSectionsQueryType = z.infer<
  typeof CourseMappingSectionsQuerySchema
>;
export type UpsertCourseMappingType = z.infer<typeof UpsertCourseMappingSchema>;
export type CourseMappingStatusItemType = z.infer<
  typeof CourseMappingStatusItemSchema
>;
export type CourseMappingStatusResponseType = z.infer<
  typeof CourseMappingStatusResponseSchema
>;
export type CourseMappingByCourseItemType = z.infer<
  typeof CourseMappingByCourseItemSchema
>;
