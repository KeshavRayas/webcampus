import { z } from "zod";

export const ElectiveMappingListQuerySchema = z.object({
  semesterId: z.uuid("Invalid semester ID"),
  departmentId: z.uuid("Invalid department ID").optional(),
  cycle: z
    .enum(["PHYSICS", "CHEMISTRY", "NONE"])
    .or(z.literal(""))
    .transform((v) => (v === "" || v === "NONE" ? undefined : v))
    .optional(),
});

export const ElectiveMappingCourseQuerySchema = z.object({
  courseId: z.uuid("Invalid course ID"),
});

export const ElectiveStudentAssignmentInputSchema = z.object({
  studentId: z.uuid("Invalid student ID"),
  electiveBatchId: z.uuid("Invalid elective batch ID"),
});

export const SaveElectiveMappingSchema = z.object({
  courseId: z.uuid("Invalid course ID"),
  electiveMappingVersion: z.number().int().positive(),
  assignments: z.array(ElectiveStudentAssignmentInputSchema),
});

export const OverridePeCourseSchema = z.object({
  studentId: z.uuid("Invalid student ID"),
  fromCourseId: z.uuid("Invalid from course ID"),
  toCourseId: z.uuid("Invalid to course ID"),
  reason: z.string().trim().min(1).optional(),
  fromCourseVersion: z.number().int().positive().optional(),
  toCourseVersion: z.number().int().positive().optional(),
});

export const RenameElectiveBatchSchema = z.object({
  electiveBatchId: z.uuid("Invalid elective batch ID"),
  name: z.string().trim().min(1).max(100),
});

export const DeleteElectiveBatchSchema = z.object({
  electiveBatchId: z.uuid("Invalid elective batch ID"),
});

export const ElectiveMappingCsvRowSchema = z.object({
  usn: z.string().trim().min(1),
  batchName: z.string().trim().optional(),
  batchId: z.string().uuid().optional(),
});

export const ValidateElectiveMappingCsvSchema = z.object({
  courseId: z.uuid("Invalid course ID"),
  rows: z.array(ElectiveMappingCsvRowSchema).min(1),
});

export type ElectiveMappingListQueryType = z.infer<
  typeof ElectiveMappingListQuerySchema
>;
export type ElectiveMappingCourseQueryType = z.infer<
  typeof ElectiveMappingCourseQuerySchema
>;
export type SaveElectiveMappingType = z.infer<typeof SaveElectiveMappingSchema>;
export type OverridePeCourseType = z.infer<typeof OverridePeCourseSchema>;
export type RenameElectiveBatchType = z.infer<typeof RenameElectiveBatchSchema>;
export type DeleteElectiveBatchType = z.infer<typeof DeleteElectiveBatchSchema>;
export type ValidateElectiveMappingCsvType = z.infer<
  typeof ValidateElectiveMappingCsvSchema
>;
