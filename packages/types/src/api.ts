export type SuccessResponse<T> = {
  status: "success";
  message: string;
  data: T | null;
};

export type ErrorResponse = {
  status: "error";
  message: string;
  error: string;
};

/**
 * Generic interface for consistent API responses.
 *
 * @template T - The type of the response `data` payload.
 */
export type BaseResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Input types that allow unknown error but output string error
 */
export type SuccessInputParams<T> = {
  status: "success";
  message: string;
  data: T | null;
};

export type ErrorInputParams = {
  status: "error";
  message: string;
  error: unknown;
};

export type BaseInputParams<T> = SuccessInputParams<T> | ErrorInputParams;

export type PaginationMetadata = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: PaginationMetadata;
};

export type FacultyHandlingAssignmentDTO = {
  assignmentId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  semesterNumber: number;
  section: string;
  batchName?: string;
  assignmentType: "THEORY" | "LAB";
  studentCount: number;
};

export type FacultyHandlingStudentDTO = {
  studentId: string;
  usn: string;
  name: string;
  email: string;
  section: string;
  batchName?: string;
  semesterNumber: number;
};

export type FacultyHandlingFilterOptionsDTO = {
  academicTerms: {
    id: string;
    year: string;
    type: "odd" | "even";
  }[];
  semesters: {
    id: string;
    academicTermId: string;
    programType: "UG" | "PG";
    semesterNumber: number;
  }[];
  sections: {
    id: string;
    name: string;
    semesterId: string;
  }[];
};
