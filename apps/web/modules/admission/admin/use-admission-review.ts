"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { toast } from "react-toastify";

export const useAdmissionReview = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await axios.patch(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/${id}/approve`,
        {},
        { withCredentials: true }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message || "Admission approved");
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.message || "Failed to approve admission");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      return await axios.patch(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/${id}/reject`,
        {},
        { withCredentials: true }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message || "Admission rejected");
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.message || "Failed to reject admission");
    },
  });

  return {
    onApprove: approveMutation.mutate,
    onReject: rejectMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
};
