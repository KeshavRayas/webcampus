"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { toast } from "react-toastify";

export const useAdmissionCancel = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      cancellationReason: string;
      cancellationDescription?: string;
    }) => {
      return await axios.post<SuccessResponse<null>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/${payload.id}/cancel`,
        {
          cancellationReason: payload.cancellationReason,
          cancellationDescription: payload.cancellationDescription,
        },
        { withCredentials: true }
      );
    },
    onSuccess: (response: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(response.data.message || "Admission cancelled");
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to cancel admission"
      );
    },
  });

  return {
    onCancel: mutation.mutate,
    isCancelling: mutation.isPending,
  };
};
