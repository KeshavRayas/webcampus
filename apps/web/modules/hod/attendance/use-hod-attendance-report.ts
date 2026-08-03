"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import axios from "axios";

const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

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
      const res = await axios.get(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/attendance-report/filter-options`,
        { withCredentials: true }
      );
      return res.data.data;
    },
  });
};

export const useHODAttendanceCourses = (semesterId: string, cycle: string) => {
  return useQuery({
    queryKey: ["hod-attendance-courses", semesterId, cycle],
    queryFn: async () => {
      if (!semesterId) return [];
      const res = await axios.get(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/attendance-report/courses`,
        {
          params: { semesterId, ...(cycle ? { cycle } : {}) },
          withCredentials: true,
        }
      );
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
      const res = await axios.get(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/attendance-report/sections`,
        {
          params: {
            semesterId,
            courseId,
            ...(cycle ? { cycle } : {}),
          },
          withCredentials: true,
        }
      );
      return res.data.data as { id: string; name: string }[];
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
      const res = await axios.get(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/attendance-report/detailed`,
        {
          params: {
            courseId: filters.courseId,
            sectionId: filters.sectionId,
          },
          withCredentials: true,
        }
      );
      return res.data.data;
    },
    enabled:
      enabled && Boolean(filters?.courseId) && Boolean(filters?.sectionId),
    retry: false,
  });
};
