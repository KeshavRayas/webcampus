import { z } from "zod";

export const ProjectMappingListQuerySchema = z.object({
  semesterId: z.uuid(),
  departmentId: z.uuid().optional(),
  cycle: z
    .enum(["PHYSICS", "CHEMISTRY", "NONE"])
    .or(z.literal(""))
    .transform((v) => (v === "" || v === "NONE" ? undefined : v))
    .optional(),
});

export const ProjectMappingGroupsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  status: z.enum(["ASSIGNED", "UNASSIGNED", "ALL"]).optional(),
  facultyId: z.uuid().optional(),
  sectionId: z.uuid().optional(),
  departmentId: z.uuid().optional(),
});

export const ProjectMappingGroupQuerySchema = z.object({
  courseId: z.uuid(),
  groupId: z.uuid(),
});

export const ProjectMappingCourseParamsSchema = z.object({
  courseId: z.uuid(),
});

export const ProjectMappingGroupParamsSchema = z.object({
  courseId: z.uuid(),
  groupId: z.uuid(),
});

export const ProjectStudentAssignmentInputSchema = z.object({
  studentId: z.uuid(),
  electiveBatchId: z.uuid(),
});

export const ProjectFacultyAssignmentInputSchema = z.object({
  electiveBatchId: z.uuid(),
  facultyId: z.uuid().nullable(),
});

export const ProjectMappingSaveSchema = z.object({
  courseId: z.uuid(),
  electiveMappingVersion: z.number().int().positive(),
  assignments: z.array(ProjectStudentAssignmentInputSchema),
  faculty: z.array(ProjectFacultyAssignmentInputSchema).optional(),
});

export const ProjectMappingSaveFacultySchema = z.object({
  courseId: z.uuid(),
  electiveMappingVersion: z.number().int().positive().optional(),
  assignments: z.array(ProjectFacultyAssignmentInputSchema),
});

export const ProjectMappingBulkAssignSchema = z.object({
  courseId: z.uuid(),
  electiveMappingVersion: z.number().int().positive().optional(),
  electiveBatchIds: z.array(z.uuid()).min(1),
  facultyId: z.uuid(),
});

export const PROJECT_MAPPING_EXCEL_ERROR_CODES = [
  "UNKNOWN_USN",
  "UNKNOWN_GROUP",
  "DUPLICATE_GROUP",
  "DUPLICATE_STUDENT",
  "UNKNOWN_FACULTY",
  "AMBIGUOUS_FACULTY",
  "WRONG_SECTION",
  "OVER_CAPACITY",
  "MISSING_GROUP",
  "MISSING_STUDENT",
  "MISSING_FACULTY",
  "EXCEEDS_ROW_LIMIT",
  "LOCKED_AFTER_ATTENDANCE",
] as const;

export const ProjectMappingExcelErrorSchema = z.object({
  row: z.number().int().positive().nullable(),
  column: z.string().nullable(),
  code: z.enum(PROJECT_MAPPING_EXCEL_ERROR_CODES),
  message: z.string(),
  value: z.string().optional(),
});

export const ProjectMappingExcelValidateResponseSchema = z.object({
  assignments: z.array(ProjectStudentAssignmentInputSchema),
  facultyAssignments: z.array(ProjectFacultyAssignmentInputSchema),
});

export type ProjectMappingListQuery = z.infer<
  typeof ProjectMappingListQuerySchema
>;
export type ProjectMappingGroupsQuery = z.infer<
  typeof ProjectMappingGroupsQuerySchema
>;
export type ProjectMappingGroupQuery = z.infer<
  typeof ProjectMappingGroupQuerySchema
>;
export type ProjectMappingCourseParams = z.infer<
  typeof ProjectMappingCourseParamsSchema
>;
export type ProjectMappingGroupParams = z.infer<
  typeof ProjectMappingGroupParamsSchema
>;
export type ProjectStudentAssignmentInput = z.infer<
  typeof ProjectStudentAssignmentInputSchema
>;
export type ProjectMappingSave = z.infer<typeof ProjectMappingSaveSchema>;
export type ProjectFacultyAssignmentInput = z.infer<
  typeof ProjectFacultyAssignmentInputSchema
>;
export type ProjectMappingSaveFaculty = z.infer<
  typeof ProjectMappingSaveFacultySchema
>;
export type ProjectMappingBulkAssign = z.infer<
  typeof ProjectMappingBulkAssignSchema
>;
export type ProjectMappingExcelErrorCode =
  (typeof PROJECT_MAPPING_EXCEL_ERROR_CODES)[number];
export type ProjectMappingExcelError = z.infer<
  typeof ProjectMappingExcelErrorSchema
>;
export type ProjectMappingExcelValidateResponse = z.infer<
  typeof ProjectMappingExcelValidateResponseSchema
>;
