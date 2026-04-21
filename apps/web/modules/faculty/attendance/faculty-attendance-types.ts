import {
  AttendanceSessionTimingModeType,
  AttendanceRecordStatusType,
  FacultyFixedTimingCodeType,
} from "@webcampus/schemas/faculty";

export type FacultyAttendanceFormState = {
  sessionDate: Date | undefined;
  courseId: string;
  sectionId: string;
  timingMode: AttendanceSessionTimingModeType;
  fixedTimingCode: FacultyFixedTimingCodeType | "";
  customStartTime: string;
  customEndTime: string;
};

export type ListFacultyAttendanceSessionsFilters = {
  sessionDate?: string;
  courseId?: string;
  sectionId?: string;
  page?: number;
  limit?: number;
};

export type AttendanceChecklistRow = {
  studentId: string;
  usn: string;
  name: string;
  status: AttendanceRecordStatusType | null;
  previousAttendancePercentage: number;
};
