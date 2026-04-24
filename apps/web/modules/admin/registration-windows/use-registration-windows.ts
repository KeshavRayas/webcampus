"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse, ErrorResponse } from "@webcampus/types/api";
import axios, { AxiosError } from "axios";
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
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["admin-registration-windows", filters],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<RegistrationWindowRow[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/registration-windows`,
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

export const useCreateRegistrationWindow = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RegistrationWindowFilters) => {
      return axios.post<BaseResponse<RegistrationWindowRow>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/registration-windows`,
        payload,
        { withCredentials: true }
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
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isOpen }: { id: string; isOpen: boolean }) => {
      return axios.patch<BaseResponse<RegistrationWindowRow>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/registration-windows/${id}/toggle`,
        { isOpen },
        { withCredentials: true }
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
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["admin-registration-window-courses", windowId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<RegistrationWindowCourseRow[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/registration-windows/${windowId}/courses`,
        {
          withCredentials: true,
        }
      );

      if (res.data.status === "success") {
        return res.data.data || [];
      }

      return [];
    },
    enabled: !!windowId,
  });
};
