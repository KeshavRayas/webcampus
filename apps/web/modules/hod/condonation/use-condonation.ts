"use client";

import type { CondonationReportData } from "@/components/academics/reports/condonation-tables";
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

export type HODCondonationRevokeResponse = {
  attendanceId: string;
  condonationStatus: string;
  percentage: number;
};

const buildQueryKey = (status: string, filters: HODCondonationFilters) =>
  [
    "hod-condonation",
    status,
    filters.academicTermId,
    filters.semesterId,
    filters.courseId ?? null,
    filters.sectionId ?? null,
    filters.search ?? "",
  ] as const;

export const useHODCondonationStudents = (
  filters: HODCondonationFilters,
  status: "pending" | "approved",
  enabled: boolean
) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: buildQueryKey(status, filters),
    queryFn: async () => {
      const res = await axios.get<BaseResponse<HODCondonationStudentRow[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/condonation/students`,
        {
          params: {
            academicTermId: filters.academicTermId,
            semesterId: filters.semesterId,
            status,
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

const invalidateCondonationQueries = (
  queryClient: ReturnType<typeof useQueryClient>
) => {
  queryClient.invalidateQueries({ queryKey: ["hod-condonation"] });
  queryClient.invalidateQueries({ queryKey: ["hod-condonation-report"] });
};

export const useHODCondonationReport = (
  filters: {
    academicTermId: string;
    semesterId: string;
    courseId: string;
    sectionId?: string;
    cycle?: string;
  } | null,
  enabled: boolean
) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["hod-condonation-report", filters],
    queryFn: async (): Promise<CondonationReportData> => {
      if (!filters) {
        throw new Error("Missing report filters");
      }
      const res = await axios.get<BaseResponse<CondonationReportData>>(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/condonation/report`,
        {
          params: {
            academicTermId: filters.academicTermId,
            semesterId: filters.semesterId,
            courseId: filters.courseId,
            ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
            ...(filters.cycle ? { cycle: filters.cycle } : {}),
          },
          withCredentials: true,
        }
      );
      if (res.data.status === "success" && res.data.data) {
        return res.data.data;
      }
      throw new Error(res.data.message || "Failed to fetch condonation report");
    },
    enabled:
      enabled && Boolean(filters?.semesterId) && Boolean(filters?.courseId),
    retry: false,
  });
};

export const useHODApproveCondonation = () => {
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
      invalidateCondonationQueries(queryClient);
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to approve condonation"
      );
    },
  });
};

export const useHODRevokeCondonation = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attendanceId: string) => {
      return axios.patch<BaseResponse<HODCondonationRevokeResponse>>(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/condonation/${attendanceId}/revoke`,
        {},
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      invalidateCondonationQueries(queryClient);
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to revoke condonation"
      );
    },
  });
};
