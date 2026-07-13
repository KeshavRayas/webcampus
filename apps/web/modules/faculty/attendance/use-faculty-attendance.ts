"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOrOpenFacultyAttendanceSession,
  CreateOrOpenSessionPayload,
  deleteFacultyAttendanceSession,
  getFacultyAttendanceFilterOptions,
  getFacultyAttendanceSessionDetail,
  getFacultyAttendanceSessionStudents,
  listFacultyAttendanceSessions,
  SessionDetailQuery,
  SessionStudentsQuery,
  updateFacultyAttendanceSession,
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
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: ["faculty-attendance", "sessions"],
      });
      await queryClient.cancelQueries({
        queryKey: ["faculty-attendance", "session-detail"],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["faculty-attendance", "sessions"],
        refetchType: "none",
      });
      queryClient.invalidateQueries({
        queryKey: ["faculty-attendance", "session-detail"],
        refetchType: "none",
      });
      queryClient
        .refetchQueries({
          queryKey: ["faculty-attendance", "sessions"],
        })
        .catch(() => {});
      queryClient
        .refetchQueries({
          queryKey: ["faculty-attendance", "session-detail"],
        })
        .catch(() => {});
    },
    onError: () => {
      queryClient.invalidateQueries({
        queryKey: ["faculty-attendance", "sessions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["faculty-attendance", "session-detail"],
      });
    },
  });
};

export const useUpdateFacultyAttendanceSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      studentStatuses,
    }: {
      sessionId: string;
      studentStatuses: { studentId: string; status: "PRESENT" | "ABSENT" }[];
    }) => updateFacultyAttendanceSession(sessionId, { studentStatuses }),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: ["faculty-attendance", "sessions"],
      });
      await queryClient.cancelQueries({
        queryKey: ["faculty-attendance", "session-detail"],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["faculty-attendance", "sessions"],
        refetchType: "none",
      });
      queryClient.invalidateQueries({
        queryKey: ["faculty-attendance", "session-detail"],
        refetchType: "none",
      });
      queryClient
        .refetchQueries({
          queryKey: ["faculty-attendance", "sessions"],
        })
        .catch(() => {});
      queryClient
        .refetchQueries({
          queryKey: ["faculty-attendance", "session-detail"],
        })
        .catch(() => {});
    },
    onError: () => {
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
  enabled = true,
  options?: {
    queryKeySuffix?: readonly unknown[];
    staleTime?: number;
  }
) => {
  return useQuery({
    queryKey: [
      "faculty-attendance",
      "sessions",
      ...(options?.queryKeySuffix ?? []),
      filters,
    ],
    queryFn: ({ signal }) => listFacultyAttendanceSessions(filters, signal),
    enabled,
    staleTime: options?.staleTime,
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

export const useDeleteFacultyAttendanceSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) =>
      deleteFacultyAttendanceSession(sessionId),
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
