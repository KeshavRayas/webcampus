"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse, ErrorResponse } from "@webcampus/types/api";
import axios, { AxiosError } from "axios";
import { toast } from "react-toastify";

export interface FreezeStateRow {
  courseAssignmentId: string;
  course: {
    id: string;
    code: string;
    name: string;
    department: {
      id: string;
      name: string;
    };
  };
  semester: {
    id: string;
    number: number;
    academicYear: {
      id: string;
      year: string;
    };
  };
  faculty: {
    id: string;
    user: {
      name: string;
      email: string;
    };
  };
  freeze: {
    isLocked: boolean;
    lockedBy: "FACULTY" | "HOD" | "ADMIN" | null;
    facultyFrozen: boolean;
    hodFrozen: boolean;
    adminFrozen: boolean;
  };
}

export interface AttendanceFreezeFilters {
  departmentId?: string;
  academicYearId?: string;
  semesterId?: string;
}

export const useAttendanceFreezeData = (
  filters: AttendanceFreezeFilters,
  enabled: boolean
) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["attendance-freeze", filters],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<FreezeStateRow[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/freeze`,
        {
          params: {
            ...(filters.departmentId
              ? { departmentId: filters.departmentId }
              : {}),
            ...(filters.academicYearId
              ? { academicYearId: filters.academicYearId }
              : {}),
            ...(filters.semesterId ? { semesterId: filters.semesterId } : {}),
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

export const useToggleAttendanceFreeze = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseAssignmentId,
    }: {
      courseAssignmentId: string;
    }) => {
      return axios.patch<BaseResponse<FreezeStateRow["freeze"]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/freeze/${courseAssignmentId}/toggle`,
        {},
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["attendance-freeze"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to toggle freeze state"
      );
    },
  });
};
