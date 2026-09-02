"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";

export type HODAttendanceFilterOptions = {
  academicTerms: { id: string; year: string; type: "odd" | "even" }[];
  semesters: {
    id: string;
    academicTermId: string;
    programType: "UG" | "PG";
    semesterNumber: number;
  }[];
  departmentType: string;
};

export type HODAttendanceDetailedRaw = {
  sessions: { id: string; sessionDate: string; timingMode: string }[];
  students: {
    studentId: string;
    usn: string;
    name: string;
    presentCount: number;
    absentCount: number;
    totalCount: number;
    percentage: number;
    attendanceBySession: { sessionId: string; status: string | null }[];
  }[];
};

export const useHODAttendanceFilterOptions = () => {
  return useQuery({
    queryKey: ["hod-attendance-filter-options"],
    queryFn: async (): Promise<HODAttendanceFilterOptions> => {
      const res = await apiClient.get(`/hod/attendance-report/filter-options`);
      return res.data.data;
    },
  });
};

export const useHODAttendanceCourses = (semesterId: string, cycle: string) => {
  return useQuery({
    queryKey: ["hod-attendance-courses", semesterId, cycle],
    queryFn: async () => {
      if (!semesterId) return [];
      const res = await apiClient.get(`/hod/attendance-report/courses`, {
        params: { semesterId, ...(cycle ? { cycle } : {}) },
      });
      return res.data.data as { id: string; code: string; name: string }[];
    },
    enabled: !!semesterId,
  });
};

export const useHODAttendanceSections = (
  semesterId: string,
  courseId: string,
  cycle: string
) => {
  return useQuery({
    queryKey: ["hod-attendance-sections", semesterId, courseId, cycle],
    queryFn: async () => {
      if (!courseId) return [];
      const res = await apiClient.get(`/hod/attendance-report/sections`, {
        params: {
          semesterId,
          courseId,
          ...(cycle ? { cycle } : {}),
        },
      });
      return res.data.data as {
        id: string;
        name: string;
        isElectiveBatch?: boolean;
      }[];
    },
    enabled: !!courseId,
  });
};

export const useHODAttendanceDetailedReport = (
  filters: { courseId: string; sectionId: string } | null,
  enabled: boolean
) => {
  return useQuery({
    queryKey: ["hod-attendance-detailed-report", filters],
    queryFn: async (): Promise<HODAttendanceDetailedRaw> => {
      if (!filters) {
        throw new Error("Missing report filters");
      }
      const res = await apiClient.get(`/hod/attendance-report/detailed`, {
        params: {
          courseId: filters.courseId,
          sectionId: filters.sectionId,
        },
      });
      return res.data.data;
    },
    enabled:
      enabled && Boolean(filters?.courseId) && Boolean(filters?.sectionId),
    retry: false,
  });
};
