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

export type AttendanceWindowFrozenBy = {
  frozenByRole: "FACULTY" | "HOD" | "ADMIN" | null;
  frozenByUsername: string | null;
  frozenByDisplay: string | null;
};

export type AttendanceWindowFreeze = {
  displayState: AttendanceWindowDisplayState;
  lockedBy: "FACULTY" | "HOD" | "ADMIN" | null;
  frozenBy: AttendanceWindowFrozenBy;
  frozenAt: string | null;
  message: string | null;
};

export type AttendanceWindowRow = {
  courseAssignmentId: string;
  courseCode: string;
  courseName: string;
  sectionId: string;
  sectionName: string;
  batchName: string | null;
  assignmentType: string;
  freeze: AttendanceWindowFreeze;
};

export type AttendanceWindowFilters = {
  academicTermId: string;
  semesterId: string;
  sectionId?: string;
};

export const useAttendanceWindows = (
  filters: AttendanceWindowFilters,
  enabled: boolean
) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["faculty-attendance-windows", filters],
    queryFn: async () => {
      const params: Record<string, string> = {
        academicTermId: filters.academicTermId,
        semesterId: filters.semesterId,
      };
      const res = await axios.get<BaseResponse<AttendanceWindowRow[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/attendance-windows`,
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

export type FacultySection = { id: string; name: string };

export const useFacultySections = (
  semesterId: string | undefined,
  enabled: boolean
) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["faculty-sections", semesterId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<FacultySection[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/attendance-windows/sections`,
        { params: { semesterId }, withCredentials: true }
      );
      if (res.data.status === "success") {
        return res.data.data || [];
      }
      throw new Error(res.data.message || "Failed to fetch sections");
    },
    enabled,
  });
};

export const useBulkFreezeAttendanceWindows = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AttendanceWindowFilters) => {
      return axios.post<BaseResponse<{ processed: number }>>(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/attendance-windows/freeze-filtered`,
        payload,
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["faculty-attendance-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to freeze attendance windows"
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
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/attendance-windows/${courseAssignmentId}/freeze`,
        {},
        { withCredentials: true }
      );
      return res;
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["faculty-attendance-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.message || "Failed to freeze window");
    },
  });
};
