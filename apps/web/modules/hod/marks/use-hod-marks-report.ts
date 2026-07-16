"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import axios from "axios";

const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
}

interface AcademicTerm {
  id: string;
  year: number;
  type: string;
}

interface Semester {
  id: string;
  semesterNumber: number;
}

interface FilterOptions {
  academicTerms: AcademicTerm[];
  semesters: Semester[];
  departmentType: string;
}

interface Course {
  id: string;
  code: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
}

export interface Assessment {
  id: string;
  title: string;
  totalMarks: number;
}

interface MarksReportRow {
  studentId: string;
  usn: string;
  name: string;
  marksObtained: number | null;
}

export const useHODMarksFilterOptions = () => {
  return useQuery<FilterOptions>({
    queryKey: ["hod-marks-filter-options"],
    queryFn: async () => {
      const res = await axios.get<ApiResponse<FilterOptions>>(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/marks-report/filter-options`,
        {
          withCredentials: true,
        }
      );

      return res.data.data;
    },
  });
};

export const useHODMarksCourses = (semesterId: string, cycle: string) => {
  return useQuery<Course[]>({
    queryKey: ["hod-marks-courses", semesterId, cycle],
    queryFn: async () => {
      if (!semesterId) return [];

      const res = await axios.get<ApiResponse<Course[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/marks-report/courses`,
        {
          params: { semesterId, cycle },
          withCredentials: true,
        }
      );

      return res.data.data;
    },
    enabled: !!semesterId,
  });
};

export const useHODMarksSections = (
  semesterId: string,
  courseId: string,
  cycle: string
) => {
  return useQuery<Section[]>({
    queryKey: ["hod-marks-sections", semesterId, courseId, cycle],
    queryFn: async () => {
      if (!courseId) return [];

      const res = await axios.get<ApiResponse<Section[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/marks-report/sections`,
        {
          params: { semesterId, courseId, cycle },
          withCredentials: true,
        }
      );

      return res.data.data;
    },
    enabled: !!courseId,
  });
};

export const useHODMarksAssessments = (courseId: string) => {
  return useQuery<Assessment[]>({
    queryKey: ["hod-marks-assessments", courseId],
    queryFn: async () => {
      if (!courseId) return [];

      const res = await axios.get<ApiResponse<Assessment[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/marks-report/assessments`,
        {
          params: { courseId },
          withCredentials: true,
        }
      );

      return res.data.data;
    },
    enabled: !!courseId,
  });
};

export const useHODMarksReportData = (
  sectionId: string,
  assessmentId: string
) => {
  return useQuery<MarksReportRow[]>({
    queryKey: ["hod-marks-report-data", sectionId, assessmentId],
    queryFn: async () => {
      if (!sectionId || !assessmentId) return [];

      const res = await axios.get<ApiResponse<MarksReportRow[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/marks-report/report`,
        {
          params: { sectionId, assessmentId },
          withCredentials: true,
        }
      );

      return res.data.data;
    },
    enabled: !!sectionId && !!assessmentId,
  });
};
