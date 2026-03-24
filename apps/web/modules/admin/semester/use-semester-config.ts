"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  CreateSemesterConfigType,
  SemesterConfigResponseType,
} from "@webcampus/schemas/admin";
import {
  BaseResponse,
  ErrorResponse,
  SuccessResponse,
} from "@webcampus/types/api";
import axios, { AxiosError } from "axios";
import { toast } from "react-toastify";

export const useSemestersByTerm = (termId: string) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["semesters", termId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<SemesterConfigResponseType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester/${termId}/semesters`,
        { withCredentials: true }
      );
      if (res.data.status === "success") {
        return res.data.data;
      }
      return [];
    },
    enabled: !!termId,
  });
};

export const useBulkUpsertSemesters = (termId: string) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSemesterConfigType[]) => {
      return await axios.put<SuccessResponse<SemesterConfigResponseType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester/${termId}/semesters`,
        data,
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["semesters", termId] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.message || "Failed to save semesters");
    },
  });
};
