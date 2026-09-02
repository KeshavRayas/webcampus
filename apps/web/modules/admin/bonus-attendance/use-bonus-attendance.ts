"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BaseResponse, ErrorResponse } from "@webcampus/types/api";
import type { AxiosError } from "axios";
import { toast } from "react-toastify";

export interface BonusAttendanceWindowRow {
  id: string;
  academicTermId: string;
  semesterId: string;
  semesterNumber: number;
  semesterProgramType: "UG" | "PG";
  academicTermLabel: string;
  departmentId: string | null;
  departmentName: string | null;
  cycle: "PHYSICS" | "CHEMISTRY" | null;
  days: number;
  isOpen: boolean;
  openedAt: string | null;
  expiresAt: string | null;
  instanceName: string;
}

export interface BonusAttendanceFilters {
  academicTermId: string;
  semesterId: string;
  departmentId?: string;
  cycle?: "PHYSICS" | "CHEMISTRY";
}

export interface CreateBonusAttendancePayload extends BonusAttendanceFilters {
  days: number;
}

export interface UpdateBonusAttendancePayload {
  id: string;
  days: number;
}

export const useBonusAttendanceWindows = (
  filters: BonusAttendanceFilters,
  enabled: boolean
) => {
  return useQuery({
    queryKey: ["admin-bonus-attendance-windows", filters],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<BonusAttendanceWindowRow[]>>(
        `/admin/bonus-attendance`,
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

export const useCreateBonusAttendanceWindow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateBonusAttendancePayload) => {
      return apiClient.post<BaseResponse<BonusAttendanceWindowRow>>(
        `/admin/bonus-attendance`,
        payload
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-bonus-attendance-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message ||
          "Failed to create bonus attendance window"
      );
    },
  });
};

export const useToggleBonusAttendanceWindow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isOpen }: { id: string; isOpen: boolean }) => {
      return apiClient.patch<BaseResponse<BonusAttendanceWindowRow>>(
        `/admin/bonus-attendance/${id}/toggle`,
        { isOpen }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-bonus-attendance-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message ||
          "Failed to update bonus attendance window"
      );
    },
  });
};

export const useUpdateBonusAttendanceWindow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, days }: UpdateBonusAttendancePayload) => {
      return apiClient.patch<BaseResponse<BonusAttendanceWindowRow>>(
        `/admin/bonus-attendance/${id}`,
        { days }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-bonus-attendance-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message ||
          "Failed to update bonus attendance window"
      );
    },
  });
};
