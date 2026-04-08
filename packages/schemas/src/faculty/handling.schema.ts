import { z } from "zod";

const positiveIntFromQuery = z.coerce
  .number()
  .int("Must be an integer")
  .positive("Must be a positive number");

const normalizeHandlingQuery = (input: unknown): unknown => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const query = input as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...query };

  if (normalized.academicTermId === undefined && query.academicTerm !== undefined) {
    normalized.academicTermId = query.academicTerm;
  }

  if (normalized.semesterId === undefined && query.semester !== undefined) {
    normalized.semesterId = query.semester;
  }

  if (normalized.sectionId === undefined && query.section !== undefined) {
    normalized.sectionId = query.section;
  }

  if (normalized.batchId === undefined && query.batch !== undefined) {
    normalized.batchId = query.batch;
  }

  return normalized;
};

const FacultyHandlingQueryObjectSchema = z.object({
  search: z.string().trim().optional(),
  academicTermId: z.string().trim().min(1).optional(),
  programType: z.enum(["UG", "PG"]).optional(),
  semesterId: z.string().trim().min(1).optional(),
  sectionId: z.string().trim().min(1).optional(),
  batchId: z.string().trim().min(1).optional(),
  academicYear: z.string().trim().min(1).optional(),
  page: positiveIntFromQuery.optional(),
  limit: positiveIntFromQuery.max(100, "Limit cannot exceed 100").optional(),
});

export const FacultyHandlingQuerySchema = z.preprocess(
  normalizeHandlingQuery,
  FacultyHandlingQueryObjectSchema
);

export const FacultyHandlingAssignmentParamsSchema = z.object({
  assignmentId: z.uuid("Invalid assignment ID"),
});

export type FacultyHandlingQueryType = z.infer<typeof FacultyHandlingQuerySchema>;
export type FacultyHandlingAssignmentParamsType = z.infer<
  typeof FacultyHandlingAssignmentParamsSchema
>;
