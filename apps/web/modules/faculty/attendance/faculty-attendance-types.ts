import {
  AttendanceRecordStatusType,
  AttendanceSessionTimingModeType,
  FacultyFixedTimingCodeType,
} from "@webcampus/schemas/faculty";

export type FacultyAttendanceFormState = {
  sessionDate: Date | undefined;
  courseId: string;
  sectionId: string;
  batchId?: string;
  electiveBatchId?: string;
  timingMode: AttendanceSessionTimingModeType;
  fixedTimingCode: FacultyFixedTimingCodeType | "";
  customStartTime: string;
  customEndTime: string;
};

export type ListFacultyAttendanceSessionsFilters = {
  sessionDate?: string;
  courseId?: string;
  sectionId?: string;
  batchId?: string;
  electiveBatchId?: string;
  page?: number;
  limit?: number;
};

export type AttendanceChecklistRow = {
  studentId: string;
  usn: string;
  name: string;
  status: AttendanceRecordStatusType | null;
  previousAttendancePercentage?: number;
};
