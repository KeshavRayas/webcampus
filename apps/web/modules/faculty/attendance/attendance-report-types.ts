import {
  FacultyAttendanceDetailedReportDTO,
  FacultyAttendanceSessionDTO,
  FacultyHandlingFilterOptionsDTO,
} from "@webcampus/types/api";

export type AcademicTermOption =
  FacultyHandlingFilterOptionsDTO["academicTerms"][number];
export type SemesterOption =
  FacultyHandlingFilterOptionsDTO["semesters"][number];

export type CourseOption = {
  id: string;
  code: string;
  name: string;
};

export type SectionOption = {
  id: string;
  name: string;
  courseId: string;
  assignmentType?: "THEORY" | "LAB";
  batchId?: string;
  labBatchNumber?: number;
};

export type AttendanceReportFilters = {
  academicTermId: string;
  programType: string;
  semesterId: string;
  courseId: string;
  sectionId: string;
  percentageFrom?: string;
  percentageTo?: string;
};

export type SessionWithCounts = FacultyAttendanceSessionDTO & {
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  percentage: number;
};

export type TabType = "status" | "detailed" | "percentage";

export type DetailedReportData = FacultyAttendanceDetailedReportDTO;
