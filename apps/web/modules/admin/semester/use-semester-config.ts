"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreateSemesterConfigType,
  SemesterConfigResponseType,
} from "@webcampus/schemas/admin";
import {
  BaseResponse,
  ErrorResponse,
  SuccessResponse,
} from "@webcampus/types/api";
import type { AxiosError } from "axios";
import { toast } from "react-toastify";

export const useSemestersByTerm = (termId: string) => {
  return useQuery({
    queryKey: ["semesters", termId],
    queryFn: async () => {
      const res = await apiClient.get<
        BaseResponse<SemesterConfigResponseType[]>
      >(`/admin/semester/${termId}/semesters`);
      if (res.data.status === "success") {
        return res.data.data;
      }
      return [];
    },
    enabled: !!termId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};

export const useBulkUpsertSemesters = (termId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSemesterConfigType[]) => {
      return await apiClient.put<SuccessResponse<SemesterConfigResponseType[]>>(
        `/admin/semester/${termId}/semesters`,
        data
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["semesters", termId] });
      // Also invalidate academic-terms since semester data is nested there
      queryClient.invalidateQueries({ queryKey: ["academic-terms"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.message || "Failed to save semesters");
    },
  });
};
