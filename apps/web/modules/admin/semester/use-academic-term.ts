"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AcademicTermResponseType,
  CreateAcademicTermType,
  SemesterLifecycleStatusType,
} from "@webcampus/schemas/admin";
import {
  BaseResponse,
  ErrorResponse,
  SuccessResponse,
} from "@webcampus/types/api";
import type { AxiosError } from "axios";
import { toast } from "react-toastify";

export const useAcademicTerms = (
  filters?: {
    status?: SemesterLifecycleStatusType;
    type?: "even" | "odd";
    year?: string;
    isCurrent?: boolean;
  },
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ["academic-terms", filters ?? {}],
    queryFn: async () => {
      const params = {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.year ? { year: filters.year } : {}),
        ...(filters?.isCurrent !== undefined
          ? { isCurrent: String(filters.isCurrent) }
          : {}),
      };

      const res = await apiClient.get<BaseResponse<AcademicTermResponseType[]>>(
        `/admin/semester`,
        {
          params,
        }
      );
      if (res.data.status === "success") {
        return res.data.data;
      }
      return [];
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateAcademicTerm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAcademicTermType) => {
      return await apiClient.post<SuccessResponse<AcademicTermResponseType>>(
        `/admin/semester`,
        data
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["academic-terms"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.message || "Failed to create term");
    },
  });
};

export const useUpdateAcademicTerm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: CreateAcademicTermType;
    }) => {
      return await apiClient.put<SuccessResponse<AcademicTermResponseType>>(
        `/admin/semester/${id}`,
        data
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["academic-terms"] });
      // Also invalidate all semester queries when term is updated
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.message || "Failed to update term");
    },
  });
};

export const useDeleteAcademicTerm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.delete<SuccessResponse<null>>(
        `/admin/semester/${id}`
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["academic-terms"] });
      // Also invalidate all semester queries when term is deleted
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.message || "Failed to delete term");
    },
  });
};
