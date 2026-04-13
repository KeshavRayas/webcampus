"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOrOpenFacultyAttendanceSession,
  CreateOrOpenSessionPayload,
  getFacultyAttendanceSessionDetail,
  getFacultyAttendanceSessionStudents,
  getFacultyAttendanceFilterOptions,
  listFacultyAttendanceSessions,
  SessionDetailQuery,
  SessionStudentsQuery,
} from "./faculty-attendance-api";
import { ListFacultyAttendanceSessionsFilters } from "./faculty-attendance-types";

export const useFacultyAttendanceFilterOptions = () => {
  return useQuery({
    queryKey: ["faculty-attendance", "filter-options"],
    queryFn: getFacultyAttendanceFilterOptions,
  });
};

export const useCreateOrOpenFacultyAttendanceSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateOrOpenSessionPayload) =>
      createOrOpenFacultyAttendanceSession(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["faculty-attendance", "sessions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["faculty-attendance", "session-detail"],
      });
    },
  });
};

export const useFacultyAttendanceSessions = (
  filters: ListFacultyAttendanceSessionsFilters,
  enabled = true
) => {
  return useQuery({
    queryKey: ["faculty-attendance", "sessions", filters],
    queryFn: () => listFacultyAttendanceSessions(filters),
    enabled,
  });
};

export const useFacultyAttendanceSessionStudents = (
  query: SessionStudentsQuery,
  enabled = true
) => {
  return useQuery({
    queryKey: ["faculty-attendance", "session-students", query],
    queryFn: () => getFacultyAttendanceSessionStudents(query),
    enabled,
  });
};

export const useFacultyAttendanceSessionDetail = (
  query: SessionDetailQuery,
  enabled = true
) => {
  return useQuery({
    queryKey: ["faculty-attendance", "session-detail", query],
    queryFn: () => getFacultyAttendanceSessionDetail(query),
    enabled,
  });
};
