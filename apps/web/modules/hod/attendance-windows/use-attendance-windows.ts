"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BaseResponse, ErrorResponse } from "@webcampus/types/api";
import type { AxiosError } from "axios";
import { toast } from "react-toastify";

export type HODAttendanceWindowDisplayState =
  | "OPEN"
  | "FROZEN_BY_FACULTY"
  | "FROZEN_BY_HOD"
  | "LOCKED_BY_ADMIN";

export type HODAttendanceWindowFreeze = {
  displayState: HODAttendanceWindowDisplayState;
  lockedBy: "FACULTY" | "HOD" | "ADMIN" | null;
  frozenAt: string | null;
  message: string | null;
  frozenByRole: "FACULTY" | "HOD" | "ADMIN" | null;
  frozenByUsername: string | null;
  frozenByDisplay: string | null;
};

export type HODAttendanceWindowRow = {
  courseAssignmentId: string;
  courseCode: string;
  courseName: string;
  department: string;
  facultyName: string;
  semester: number;
  sectionId: string;
  sectionName: string;
  batchName: string | null;
  assignmentType: "THEORY" | "LAB";
  freeze: HODAttendanceWindowFreeze;
};

export type HODAttendanceWindowFilters = {
  academicTermId: string;
  semesterId: string;
  sectionId?: string;
};

export type HODSection = {
  id: string;
  name: string;
};

export type HODBulkResult = {
  processed: number;
  skipped: number;
  failed: number;
  skippedAssignments: string[];
  failedAssignments: string[];
};

export const useHODSections = (
  semesterId: string | undefined,
  enabled: boolean
) => {
  return useQuery({
    queryKey: ["hod-sections", semesterId],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<HODSection[]>>(
        `/hod/attendance-windows/sections`,
        {
          params: semesterId ? { semesterId } : {},
        }
      );
      if (res.data.status === "success") return res.data.data || [];
      throw new Error(res.data.message || "Failed to fetch sections");
    },
    enabled,
  });
};

export const useHODAttendanceWindows = (
  filters: HODAttendanceWindowFilters,
  enabled: boolean
) => {
  return useQuery({
    queryKey: ["hod-attendance-windows", filters],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<HODAttendanceWindowRow[]>>(
        `/hod/attendance-windows`,
        {
          params: {
            academicTermId: filters.academicTermId,
            semesterId: filters.semesterId,
            ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
          },
        }
      );

      if (res.data.status === "success") {
        return res.data.data || [];
      }

      throw new Error(res.data.message || "Failed to fetch attendance windows");
    },
    enabled,
  });
};

export const useHODBulkFreezeAttendanceWindows = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: HODAttendanceWindowFilters) => {
      return apiClient.post<BaseResponse<HODBulkResult>>(
        `/hod/attendance-windows/freeze`,
        payload
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["hod-attendance-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to freeze attendance windows"
      );
    },
  });
};

export const useHODBulkUnfreezeAttendanceWindows = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: HODAttendanceWindowFilters) => {
      return apiClient.post<BaseResponse<HODBulkResult>>(
        `/hod/attendance-windows/unfreeze`,
        payload
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["hod-attendance-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to unfreeze attendance windows"
      );
    },
  });
};

export const useHODFreezeAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (courseAssignmentId: string) => {
      return apiClient.post<BaseResponse<HODAttendanceWindowRow>>(
        `/hod/attendance-windows/${courseAssignmentId}/freeze`,
        {}
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["hod-attendance-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to close attendance window"
      );
    },
  });
};

export const useHODUnfreezeAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (courseAssignmentId: string) => {
      return apiClient.post<BaseResponse<HODAttendanceWindowRow>>(
        `/hod/attendance-windows/${courseAssignmentId}/unfreeze`,
        {}
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["hod-attendance-windows"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to reopen attendance window"
      );
    },
  });
};
