"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BaseResponse, ErrorResponse } from "@webcampus/types/api";
import type { AxiosError } from "axios";
import { toast } from "react-toastify";

export type FreezingDisplayState =
  | "OPEN"
  | "FROZEN_BY_FACULTY"
  | "FROZEN_BY_HOD"
  | "LOCKED_BY_ADMIN";

export type FreezingFrozenBy = {
  frozenByRole: "FACULTY" | "HOD" | "ADMIN" | null;
  frozenByUsername: string | null;
  frozenByDisplay: string | null;
};

export type FreezingFreeze = {
  displayState: FreezingDisplayState;
  lockedBy: "FACULTY" | "HOD" | "ADMIN" | null;
  frozenBy: FreezingFrozenBy;
  frozenAt: string | null;
  message: string | null;
};

export type FreezingRow = {
  courseAssignmentId: string | null;
  electiveBatchFacultyId: string | null;
  isElective: boolean;
  domain: "section" | "group";
  courseCode: string;
  courseName: string;
  sectionId: string;
  sectionName: string;
  batchName: string | null;
  assignmentType: string;
  freeze: FreezingFreeze;
};

export type FreezingFilters = {
  academicTermId: string;
  semesterId: string;
  sectionId?: string;
  electiveBatchId?: string;
};

export const useFreezingWindows = (
  filters: FreezingFilters,
  enabled: boolean
) => {
  return useQuery({
    queryKey: ["faculty-freezing", filters],
    queryFn: async () => {
      const params: Record<string, string> = {
        academicTermId: filters.academicTermId,
        semesterId: filters.semesterId,
      };
      const res = await apiClient.get<BaseResponse<FreezingRow[]>>(
        `/faculty/attendance-windows`,
        {
          params,
        }
      );

      if (res.data.status === "success") {
        const rows = res.data.data || [];
        return rows;
      }

      throw new Error(res.data.message || "Failed to fetch freezing data");
    },
    enabled,
  });
};

export type FacultySection = {
  id: string;
  name: string;
  domain: "section" | "group";
};

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

export const useBulkFreezeWindows = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FreezingFilters) => {
      return apiClient.post<BaseResponse<{ processed: number }>>(
        `/faculty/attendance-windows/freeze-filtered`,
        payload
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["faculty-freezing"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.message || "Failed to freeze");
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
      const res = await apiClient.post<BaseResponse<FreezingRow>>(
        `${path}`,
        {}
      );
      return res;
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["faculty-freezing"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.message || "Failed to freeze");
    },
  });
};
