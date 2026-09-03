"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BaseResponse, ErrorResponse } from "@webcampus/types/api";
import type { AxiosError } from "axios";
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
  courseAssignmentId: string | null;
  electiveBatchFacultyId: string | null;
  isElective: boolean;
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
  return useQuery({
    queryKey: ["faculty-attendance-windows", filters],
    queryFn: async () => {
      const params: Record<string, string> = {
        academicTermId: filters.academicTermId,
        semesterId: filters.semesterId,
      };
      const res = await apiClient.get<BaseResponse<AttendanceWindowRow[]>>(
        `/faculty/attendance-windows`,
        {
          params,
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
  return useQuery({
    queryKey: ["faculty-sections", semesterId],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<FacultySection[]>>(
        `/faculty/attendance-windows/sections`,
        { params: { semesterId } }
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AttendanceWindowFilters) => {
      return apiClient.post<BaseResponse<{ processed: number }>>(
        `/faculty/attendance-windows/freeze-filtered`,
        payload
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

export type FreezeTarget = {
  courseAssignmentId?: string | null;
  electiveBatchFacultyId?: string | null;
};

export const useFreezeAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (target: FreezeTarget) => {
      const path = target.courseAssignmentId
        ? `/faculty/attendance-windows/course-assignment/${target.courseAssignmentId}/freeze`
        : `/faculty/attendance-windows/elective-batch/${target.electiveBatchFacultyId ?? ""}/freeze`;
      const res = await apiClient.post<BaseResponse<AttendanceWindowRow>>(
        `${path}`,
        {}
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
