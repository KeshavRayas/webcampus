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
  isElective?: boolean;
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
    type: "odd" | "even" | "supplementary";
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
    isElectiveBatch?: boolean;
  }[];
  courses: {
    id: string;
    code: string;
    name: string;
    courseType: string;
    semesterId: string;
  }[];
  batches: {
    id: string;
    name: string;
    courseId: string;
    isElective: boolean;
  }[];
};

export type FacultyAttendanceCourseOptionDTO = {
  id: string;
  code: string;
  name: string;
};

export type FacultyAttendanceSectionOptionDTO = {
  id: string;
  name: string;
  courseId: string;
  assignmentType?: "THEORY" | "LAB";
  batchId?: string;
  labBatchNumber?: number;
};

export type FacultyAttendanceElectiveBatchOptionDTO = {
  id: string;
  name: string;
  courseId: string;
};

export type FacultyAttendanceFilterOptionsDTO = {
  courses: FacultyAttendanceCourseOptionDTO[];
  sections: FacultyAttendanceSectionOptionDTO[];
  electiveBatches: FacultyAttendanceElectiveBatchOptionDTO[];
};

export type FacultyAttendanceSessionDTO = {
  id: string;
  courseId: string;
  sectionId: string;
  batchId?: string;
  electiveBatchId?: string;
  electiveBatchName?: string;
  labBatchNumber?: number;
  sessionDate: string;
  timingCode: string;
  timingLabel: string;
  timingStartTime: string;
  timingEndTime: string;
  courseCode: string;
  courseName: string;
  sectionName: string;
  createdAt: string;
};

export type FacultyAttendanceDetailedReportDTO = {
  sessions: {
    id: string;
    sessionDate: string;
  }[];
  students: {
    studentId: string;
    usn: string;
    name: string;
    sessionStatuses: ("PRESENT" | "ABSENT")[];
    condonationStatus: "NOT_REQUESTED" | "PENDING" | "APPROVED" | "REJECTED";
    totalSessions: number;
    presentSessions: number;
    absentSessions: number;
    percentage: number;
    status: "Eligible" | "Not Eligible";
  }[];
};

export type AttendanceRecordStatusDTO = "PRESENT" | "ABSENT";

export type FacultyAttendanceStudentStatusInputDTO = {
  studentId: string;
  status: AttendanceRecordStatusDTO;
};

export type CreateOrOpenFacultyAttendanceSessionPayloadDTO = {
  courseId: string;
  sectionId?: string;
  batchId?: string;
  electiveBatchId?: string;
  sessionDate: string;
  timingMode: "FIXED" | "CUSTOM";
  timingCode?: string;
  timingStartTime?: string;
  timingEndTime?: string;
  studentStatuses?: FacultyAttendanceStudentStatusInputDTO[];
};

export type FacultyAttendanceSessionInitializationSummaryDTO = {
  totalStudents: number;
  presentCount: number;
  absentCount: number;
};

export type FacultyAttendanceSessionStudentDTO = {
  studentId: string;
  usn: string;
  name: string;
  status: AttendanceRecordStatusDTO;
  previousAttendancePercentage?: number;
};

export type FacultyAttendanceSessionStudentsDTO = {
  students: FacultyAttendanceSessionStudentDTO[];
};

export type FacultyAttendanceSessionDetailDTO = {
  session: FacultyAttendanceSessionDTO;
  students: FacultyAttendanceSessionStudentDTO[];
};

export type CreateOrOpenFacultyAttendanceSessionDTO = {
  session: FacultyAttendanceSessionDTO;
  created: boolean;
  attendanceInitialization: FacultyAttendanceSessionInitializationSummaryDTO;
};

export type UpdateFacultyAttendanceSessionPayloadDTO = {
  studentStatuses?: FacultyAttendanceStudentStatusInputDTO[];
};

export type DeleteFacultyAttendanceSessionDTO = {
  sessionId: string;
  courseId: string;
  affectedStudentCount: number;
};

export type AdmissionConstantRecordDTO = {
  id: string;
  modeOfAdmission: string;
  quota: string | null;
  categoryClaimed: string;
  categoryAllotted: string;
};

export type AdmissionConstantsOptionsDTO = {
  modes: string[];
  categoriesClaimed: Record<string, string[]>;
  categoriesAllotted: Record<string, string[]>;
  quotas: Record<string, string[]>;
};

export type AdmissionReferenceListsPayloadDTO = {
  quotas: string[];
  categoriesClaimed: string[];
  categoriesAllotted: string[];
};

export type AdmissionReferenceCreatePayloadDTO =
  AdmissionReferenceListsPayloadDTO & {
    modeOfAdmission: string;
  };
