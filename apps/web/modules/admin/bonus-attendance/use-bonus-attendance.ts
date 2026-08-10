"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse, ErrorResponse } from "@webcampus/types/api";
import axios, { AxiosError } from "axios";
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

export const useBonusAttendanceWindows = (
  filters: BonusAttendanceFilters,
  enabled: boolean
) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["admin-bonus-attendance-windows", filters],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<BonusAttendanceWindowRow[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/bonus-attendance`,
        {
          params: {
            academicTermId: filters.academicTermId,
            semesterId: filters.semesterId,
            ...(filters.departmentId
              ? { departmentId: filters.departmentId }
              : {}),
            ...(filters.cycle ? { cycle: filters.cycle } : {}),
          },
          withCredentials: true,
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
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateBonusAttendancePayload) => {
      return axios.post<BaseResponse<BonusAttendanceWindowRow>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/bonus-attendance`,
        payload,
        { withCredentials: true }
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
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isOpen }: { id: string; isOpen: boolean }) => {
      return axios.patch<BaseResponse<BonusAttendanceWindowRow>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/bonus-attendance/${id}/toggle`,
        { isOpen },
        { withCredentials: true }
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
