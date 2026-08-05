import { z } from "zod";

// ─── Archive Query Schemas ───

export const ArchiveSemesterQuerySchema = z.object({
  academicTermId: z.string().uuid().optional(),
  programType: z.enum(["UG", "PG"]).optional(),
});

// ─── Archive Response Types ───

export type ArchiveSemesterQueryType = z.infer<
  typeof ArchiveSemesterQuerySchema
>;

export type ArchiveSummaryType = {
  semesterId: string;
  semesterNumber: number;
  programType: string;
  academicTermType: string;
  academicTermYear: string;
  archivedAt: Date;
  archivedBy: string;
  counts: {
    departments: number;
    faculty: number;
    admins: number;
  };
};

export type ArchiveResultType = {
  semester: {
    id: string;
    originalId: string;
    semesterNumber: number;
    programType: string;
  };
  archivedCounts: {
    departments: number;
    faculty: number;
    admins: number;
  };
  archivedAt: Date;
};
