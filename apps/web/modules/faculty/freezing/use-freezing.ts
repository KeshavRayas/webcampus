"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import type { BaseResponse, ErrorResponse } from "@webcampus/types/api";
import axios, { AxiosError } from "axios";
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
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["faculty-freezing", filters],
    queryFn: async () => {
      const params: Record<string, string> = {
        academicTermId: filters.academicTermId,
        semesterId: filters.semesterId,
      };
      const res = await axios.get<BaseResponse<FreezingRow[]>>(
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

export const useBulkFreezeWindows = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FreezingFilters) => {
      return axios.post<BaseResponse<{ processed: number }>>(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/attendance-windows/freeze-filtered`,
        payload,
        { withCredentials: true }
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
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (target: FreezeTarget) => {
      const path = target.courseAssignmentId
        ? `/faculty/attendance-windows/course-assignment/${target.courseAssignmentId}/freeze`
        : `/faculty/attendance-windows/elective-batch/${target.electiveBatchFacultyId ?? ""}/freeze`;
      const res = await axios.post<BaseResponse<FreezingRow>>(
        `${NEXT_PUBLIC_API_BASE_URL}${path}`,
        {},
        { withCredentials: true }
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
