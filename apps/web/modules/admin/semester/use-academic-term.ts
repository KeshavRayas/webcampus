"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  AcademicTermResponseType,
  CreateAcademicTermType,
} from "@webcampus/schemas/admin";
import {
  BaseResponse,
  ErrorResponse,
  SuccessResponse,
} from "@webcampus/types/api";
import axios, { AxiosError } from "axios";
import { toast } from "react-toastify";

export const useAcademicTerms = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["academic-terms"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<AcademicTermResponseType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester`,
        { withCredentials: true }
      );
      if (res.data.status === "success") {
        return res.data.data;
      }
      return [];
    },
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
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.message || "Failed to delete term");
    },
  });
};
