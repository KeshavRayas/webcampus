"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { toast } from "react-toastify";

type FeePaymentPayload = {
  feePaid: number;
  feeReceiptNumber?: string;
  scholarship?: boolean;
  sspId?: string;
};

export const useFeePayment = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: { id: string; data: FeePaymentPayload }) => {
      return await axios.patch(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/${payload.id}/fee`,
        payload.data,
        { withCredentials: true }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message || "Fee payment recorded");
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
      queryClient.invalidateQueries({ queryKey: ["fee-payments"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to record fee payment"
      );
    },
  });

  return {
    recordPayment: mutation.mutate,
    isRecording: mutation.isPending,
  };
};
