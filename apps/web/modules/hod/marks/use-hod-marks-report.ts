"use client";

import { apiClient } from "@/lib/api-client";
import type { MarksReportData } from "@/modules/faculty/marks-report/marks-report-types";
import { useQuery } from "@tanstack/react-query";

export type HODMarksFilterOptions = {
  academicTerms: { id: string; year: string; type: "odd" | "even" }[];
  semesters: {
    id: string;
    academicTermId: string;
    programType: "UG" | "PG";
    semesterNumber: number;
  }[];
  departmentType: string;
};

export type HODMarksAssessment = {
  id: string;
  title: string;
  totalMarks: number;
};

export const useHODMarksFilterOptions = () => {
  return useQuery({
    queryKey: ["hod-marks-filter-options"],
    queryFn: async (): Promise<HODMarksFilterOptions> => {
      const res = await apiClient.get(`/hod/marks-report/filter-options`);
      return res.data.data;
    },
  });
};

export const useHODMarksCourses = (semesterId: string, cycle: string) => {
  return useQuery({
    queryKey: ["hod-marks-courses", semesterId, cycle],
    queryFn: async () => {
      if (!semesterId) return [];
      const res = await apiClient.get(`/hod/marks-report/courses`, {
        params: { semesterId, ...(cycle ? { cycle } : {}) },
      });
      return res.data.data as { id: string; code: string; name: string }[];
    },
    enabled: !!semesterId,
  });
};

export const useHODMarksSections = (
  semesterId: string,
  courseId: string,
  cycle: string
) => {
  return useQuery({
    queryKey: ["hod-marks-sections", semesterId, courseId, cycle],
    queryFn: async () => {
      if (!courseId) return [];
      const res = await apiClient.get(`/hod/marks-report/sections`, {
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

export const useHODMarksAssessments = (courseId: string) => {
  return useQuery({
    queryKey: ["hod-marks-assessments", courseId],
    queryFn: async (): Promise<HODMarksAssessment[]> => {
      if (!courseId) return [];
      const res = await apiClient.get(`/hod/marks-report/assessments`, {
        params: { courseId },
      });
      return res.data.data;
    },
    enabled: !!courseId,
  });
};

export const useHODMarksReportData = (
  filters: {
    courseId: string;
    sectionId: string;
    assessmentId?: string;
  } | null,
  enabled: boolean
) => {
  return useQuery({
    queryKey: ["hod-marks-report-data", filters],
    queryFn: async (): Promise<MarksReportData> => {
      if (!filters) {
        throw new Error("Missing report filters");
      }
      const res = await apiClient.get(`/hod/marks-report/report`, {
        params: {
          courseId: filters.courseId,
          sectionId: filters.sectionId,
          ...(filters.assessmentId
            ? { assessmentId: filters.assessmentId }
            : {}),
        },
      });
      return res.data.data;
    },
    enabled:
      enabled && Boolean(filters?.courseId) && Boolean(filters?.sectionId),
    retry: false,
  });
};
