"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import axios from "axios";

const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

export const useHODAttendanceFilterOptions = () => {
  return useQuery({
    queryKey: ["hod-attendance-filter-options"],
    queryFn: async () => {
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
          params: { semesterId, cycle },
          withCredentials: true,
        }
      );
      return res.data.data;
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
          params: { semesterId, courseId, cycle },
          withCredentials: true,
        }
      );
      return res.data.data;
    },
    enabled: !!courseId,
  });
};
