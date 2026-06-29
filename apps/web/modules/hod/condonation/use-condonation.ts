"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import type {
  HODCondonationCourse,
  HODCondonationFilters,
  HODCondonationStudentRow,
} from "@webcampus/schemas/hod";
import type { BaseResponse, ErrorResponse } from "@webcampus/types/api";
import axios, { AxiosError } from "axios";
import { toast } from "react-toastify";

export type { HODCondonationFilters, HODCondonationStudentRow };

export type HODCondonationApproveResponse = {
  attendanceId: string;
  condonationStatus: string;
  percentage: number;
};

const buildQueryKey = (filters: HODCondonationFilters) =>
  [
    "hod-condonation",
    filters.academicTermId,
    filters.semesterId,
    filters.courseId ?? null,
    filters.sectionId ?? null,
    filters.search ?? "",
  ] as const;

export const useHODCondonationStudents = (
  filters: HODCondonationFilters,
  enabled: boolean
) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: buildQueryKey(filters),
    queryFn: async () => {
      const res = await axios.get<BaseResponse<HODCondonationStudentRow[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/condonation/students`,
        {
          params: {
            academicTermId: filters.academicTermId,
            semesterId: filters.semesterId,
            ...(filters.courseId ? { courseId: filters.courseId } : {}),
            ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
            ...(filters.search ? { search: filters.search } : {}),
          },
          withCredentials: true,
        }
      );

      if (res.data.status === "success") {
        return res.data.data || [];
      }

      throw new Error(
        res.data.message || "Failed to fetch condonation students"
      );
    },
    enabled,
  });
};

export const useHODCondonationCourses = (
  semesterId: string | undefined,
  enabled: boolean
) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["hod-condonation-courses", semesterId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<HODCondonationCourse[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/condonation/courses`,
        {
          params: semesterId ? { semesterId } : {},
          withCredentials: true,
        }
      );
      if (res.data.status === "success") return res.data.data || [];
      throw new Error(res.data.message || "Failed to fetch courses");
    },
    enabled,
  });
};

export const useHODApproveCondonation = (filters: HODCondonationFilters) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attendanceId: string) => {
      return axios.patch<BaseResponse<HODCondonationApproveResponse>>(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/condonation/${attendanceId}`,
        {},
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: buildQueryKey(filters),
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to approve condonation"
      );
    },
  });
};
