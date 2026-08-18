export type FacultyHandlingKind = "courses" | "lab";

export type FacultyHandlingFilters = {
  search: string;
  academicTerm: string;
  programType: string;
  semester: string;
  section: string;
  courseId: string;
  batchId: string;
  page: string;
  limit?: string;
};
