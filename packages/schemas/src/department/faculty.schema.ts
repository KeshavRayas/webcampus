import { z } from "zod";
import { DesignationEnum } from "../faculty/faculty.schema";

const optionalQueryString = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

export const DepartmentFacultyQuerySchema = z.object({
  name: optionalQueryString(z.string()),
  email: optionalQueryString(z.string()),
  department: optionalQueryString(z.string()),
  designation: optionalQueryString(DesignationEnum),
});

export const DepartmentFacultyResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  department: z.string(),
  designation: DesignationEnum,
  isHod: z.boolean(),
  createdAt: z.date(),
});

export type DepartmentFacultyQueryType = z.infer<
  typeof DepartmentFacultyQuerySchema
>;
export type DepartmentFacultyResponseType = z.infer<
  typeof DepartmentFacultyResponseSchema
>;
