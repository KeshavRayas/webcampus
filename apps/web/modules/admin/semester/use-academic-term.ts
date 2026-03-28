"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
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
import axios, { AxiosError } from "axios";
import { toast } from "react-toastify";

export const useAcademicTerms = (filters?: {
  status?: SemesterLifecycleStatusType;
  type?: "even" | "odd";
  year?: string;
  isCurrent?: boolean;
}) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

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

      const res = await axios.get<BaseResponse<AcademicTermResponseType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester`,
        {
          params,
          withCredentials: true,
        }
      );
      if (res.data.status === "success") {
        return res.data.data;
      }
      return [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};

export const useCreateAcademicTerm = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAcademicTermType) => {
      return await axios.post<SuccessResponse<AcademicTermResponseType>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester`,
        data,
        { withCredentials: true }
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
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: CreateAcademicTermType;
    }) => {
      return await axios.put<SuccessResponse<AcademicTermResponseType>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester/${id}`,
        data,
        { withCredentials: true }
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
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await axios.delete<SuccessResponse<null>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester/${id}`,
        { withCredentials: true }
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
