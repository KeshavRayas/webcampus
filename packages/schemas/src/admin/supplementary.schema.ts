import { z } from "zod";

const optionalQueryString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

export const CreateSupplementaryOfferingSchema = z.object({
  academicTermId: z.uuid("Invalid academic term ID"),
  courseId: z.uuid("Invalid course ID"),
});

export const SupplementaryTermParamsSchema = z.object({
  academicTermId: z.uuid("Invalid academic term ID"),
});

export const SupplementaryOfferingParamsSchema = z.object({
  id: z.uuid("Invalid offering ID"),
});

export const CreateSupplementarySectionSchema = z.object({
  name: z.string().trim().min(1, "Section name is required").max(50),
  facultyId: z.uuid("Invalid faculty ID"),
});

export const SupplementarySectionParamsSchema = z.object({
  id: z.uuid("Invalid section ID"),
});

export const AssignSupplementaryStudentsSchema = z.object({
  studentIds: z
    .array(z.uuid("Invalid student ID"))
    .min(1, "Select at least one student"),
});

export const GetSupplementaryRegistrationsQuerySchema = z.object({
  academicTermId: z.uuid("Invalid academic term ID"),
  courseId: optionalQueryString(z.uuid("Invalid course ID")),
});

export type CreateSupplementaryOfferingType = z.infer<
  typeof CreateSupplementaryOfferingSchema
>;
export type SupplementaryTermParamsType = z.infer<
  typeof SupplementaryTermParamsSchema
>;
export type SupplementaryOfferingParamsType = z.infer<
  typeof SupplementaryOfferingParamsSchema
>;
export type CreateSupplementarySectionType = z.infer<
  typeof CreateSupplementarySectionSchema
>;
export type SupplementarySectionParamsType = z.infer<
  typeof SupplementarySectionParamsSchema
>;
export type AssignSupplementaryStudentsType = z.infer<
  typeof AssignSupplementaryStudentsSchema
>;
export type GetSupplementaryRegistrationsQueryType = z.infer<
  typeof GetSupplementaryRegistrationsQuerySchema
>;
