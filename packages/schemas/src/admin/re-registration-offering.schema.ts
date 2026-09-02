import { z } from "zod";

const optionalQueryString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

export const CreateReRegistrationOfferingSchema = z.object({
  academicTermId: z.uuid("Invalid academic term ID"),
  courseId: z.uuid("Invalid course ID"),
  name: z
    .string()
    .trim()
    .min(1, "Section name is required")
    .max(50, "Section name must be at most 50 characters"),
});

export const ReRegistrationOfferingParamsSchema = z.object({
  id: z.uuid("Invalid offering section ID"),
});

export const AssignReRegistrationStudentsSchema = z.object({
  studentIds: z
    .array(z.uuid("Invalid student ID"))
    .min(1, "Select at least one student"),
});

export const GetReRegistrationOfferingsQuerySchema = z.object({
  academicTermId: optionalQueryString(z.uuid("Invalid academic term ID")),
  courseId: optionalQueryString(z.uuid("Invalid course ID")),
});

export type CreateReRegistrationOfferingType = z.infer<
  typeof CreateReRegistrationOfferingSchema
>;
export type ReRegistrationOfferingParamsType = z.infer<
  typeof ReRegistrationOfferingParamsSchema
>;
export type AssignReRegistrationStudentsType = z.infer<
  typeof AssignReRegistrationStudentsSchema
>;
export type GetReRegistrationOfferingsQueryType = z.infer<
  typeof GetReRegistrationOfferingsQuerySchema
>;
