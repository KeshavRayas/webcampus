"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BaseResponse, ErrorResponse } from "@webcampus/types/api";
import type { AxiosError } from "axios";
import { toast } from "react-toastify";

export interface RegistrationWindowRow {
  id: string;
  academicTermId: string;
  semesterId: string;
  semesterNumber: number;
  semesterProgramType: "UG" | "PG";
  academicTermLabel: string;
  departmentId: string | null;
  departmentName: string | null;
  cycle: "PHYSICS" | "CHEMISTRY" | null;
  isOpen: boolean;
  instanceName: string;
}

export interface RegistrationWindowCourseRow {
  id: string;
  code: string;
  name: string;
  courseType: string;
  ltp: string;
  totalCredits: number;
}

export interface RegistrationWindowFilters {
  academicTermId: string;
  semesterId: string;
  departmentId?: string;
  cycle?: "PHYSICS" | "CHEMISTRY";
}

export const useRegistrationWindows = (
  filters: RegistrationWindowFilters,
  enabled: boolean
) => {
  return useQuery({
    queryKey: ["admin-registration-windows", filters],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<RegistrationWindowRow[]>>(
        `/admin/registration-windows`,
        {
          params: {
            academicTermId: filters.academicTermId,
            semesterId: filters.semesterId,
            ...(filters.departmentId
              ? { departmentId: filters.departmentId }
              : {}),
            ...(filters.cycle ? { cycle: filters.cycle } : {}),
          },
        }
      );

      if (res.data.status === "success") {
        return res.data.data || [];
      }

      return [];
    },
    enabled,
  });
};

export const useCreateRegistrationWindow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RegistrationWindowFilters) => {
      return apiClient.post<BaseResponse<RegistrationWindowRow>>(
        `/admin/registration-windows`,
        payload
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-registration-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to create registration window"
      );
    },
  });
};

export const useToggleRegistrationWindow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isOpen }: { id: string; isOpen: boolean }) => {
      return apiClient.patch<BaseResponse<RegistrationWindowRow>>(
        `/admin/registration-windows/${id}/toggle`,
        { isOpen }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-registration-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to update registration window"
      );
    },
  });
};

export const useRegistrationWindowCourses = (windowId?: string) => {
  return useQuery({
    queryKey: ["admin-registration-window-courses", windowId],
    queryFn: async () => {
      const res = await apiClient.get<
        BaseResponse<RegistrationWindowCourseRow[]>
      >(`/admin/registration-windows/${windowId}/courses`);

      if (res.data.status === "success") {
        return res.data.data || [];
      }

      return [];
    },
    enabled: !!windowId,
  });
};
