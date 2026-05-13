"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import type { BaseResponse, ErrorResponse } from "@webcampus/types/api";
import axios, { AxiosError } from "axios";
import { toast } from "react-toastify";

export type AttendanceWindowDisplayState =
  | "OPEN"
  | "FROZEN_BY_FACULTY"
  | "FROZEN_BY_HOD"
  | "LOCKED_BY_ADMIN";

export type AttendanceWindowFreeze = {
  displayState: AttendanceWindowDisplayState;
  lockedBy: "FACULTY" | "HOD" | "ADMIN" | null;
  frozenAt: string | null;
  message: string | null;
  frozenByRole: "FACULTY" | "HOD" | "ADMIN" | null;
  frozenByUsername: string | null;
  frozenByDisplay: string | null;
};

export type AttendanceWindowRow = {
  courseAssignmentId: string;
  courseCode: string;
  courseName: string;
  department: string;
  hodName: string | null;
  hodUsername: string | null;
  facultyName: string;
  semester: number;
  sectionName: string;
  batchName: string | null;
  assignmentType: "THEORY" | "LAB";
  freeze: AttendanceWindowFreeze;
};

export type AttendanceWindowFilters = {
  departmentId?: string;
  academicTermId: string;
  semesterId: string;
};

export const useAttendanceWindows = (
  filters: AttendanceWindowFilters,
  enabled: boolean
) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["admin-attendance-windows", filters],
    queryFn: async () => {
      const params: Record<string, string> = {
        academicTermId: filters.academicTermId,
        semesterId: filters.semesterId,
      };
      if (filters.departmentId) {
        params.departmentId = filters.departmentId;
      }
      const res = await axios.get<BaseResponse<AttendanceWindowRow[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/attendance-windows`,
        {
          params,
          withCredentials: true,
        }
      );

      if (res.data.status === "success") {
        const rows = res.data.data || [];
        return rows;
      }

      throw new Error(res.data.message || "Failed to fetch attendance windows");
    },
    enabled,
  });
};

export const useBulkFreezeAttendanceWindows = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AttendanceWindowFilters) => {
      return axios.post<BaseResponse<{ updated: number }>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/attendance-windows/freeze`,
        payload,
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-attendance-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to freeze attendance windows"
      );
    },
  });
};

export const useBulkUnfreezeAttendanceWindows = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AttendanceWindowFilters) => {
      return axios.post<BaseResponse<{ updated: number }>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/attendance-windows/unfreeze`,
        payload,
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-attendance-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to unfreeze attendance windows"
      );
    },
  });
};

export const useFreezeAssignment = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (courseAssignmentId: string) => {
      const res = await axios.post<BaseResponse<AttendanceWindowRow>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/attendance-windows/${courseAssignmentId}/freeze`,
        {},
        { withCredentials: true }
      );
      return res;
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-attendance-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to lock attendance window"
      );
    },
  });
};

export const useUnfreezeAssignment = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (courseAssignmentId: string) => {
      return axios.post<BaseResponse<AttendanceWindowRow>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/attendance-windows/${courseAssignmentId}/unfreeze`,
        {},
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-attendance-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to reopen attendance window"
      );
    },
  });
};
