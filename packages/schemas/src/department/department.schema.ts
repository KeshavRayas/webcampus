import { z } from "zod";

/**
 * Base Department Schema
 * @description This schema is used to validate the base department data
 */
export const BaseDepartmentSchema = z.object({
  name: z.string().min(1, { message: "Department name cannot be empty" }),
  code: z.string().min(1, { message: "Department code cannot be empty" }),
  abbreviation: z
    .string()
    .min(1, { message: "Department abbreviation cannot be empty" }),
  type: z.enum(["DEGREE_GRANTING", "BASIC_SCIENCES", "SERVICE"]).optional(),
});

/**
 * Create Department Schema
 * @description This schema is used to validate the create department data
 */
export const CreateDepartmentSchema = BaseDepartmentSchema;

/**
 * Update Department Schema
 * @description This schema is used to validate the update department data
 */
export const UpdateDepartmentSchema = BaseDepartmentSchema.partial().extend({
  username: z.string().min(1, "Username is required").optional(),
  displayUsername: z
    .string()
    .min(1, "Display username is required")
    .optional(),
});

/**
 * Department Response Schema
 * @description This schema is used to validate the department response data
 */
export const DepartmentResponseSchema = BaseDepartmentSchema.extend({
  id: z.uuid(),
  userId: z.string().optional().nullable(),
  hodId: z.string().optional().nullable(),
});

export type BaseDepartmentDTO = z.infer<typeof BaseDepartmentSchema>;
export type CreateDepartmentDTO = z.infer<typeof CreateDepartmentSchema>;
export type UpdateDepartmentDTO = z.infer<typeof UpdateDepartmentSchema>;
export type DepartmentResponseDTO = z.infer<typeof DepartmentResponseSchema>;
