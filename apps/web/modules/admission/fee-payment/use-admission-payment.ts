"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { toast } from "react-toastify";

export type PaymentPayload = {
  id: string;
  feePaid?: number;
  feeReceiptNumber?: string;
};

export const useAdmissionPayment = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async ({ id, feePaid, feeReceiptNumber }: PaymentPayload) => {
      return await axios.patch<SuccessResponse<null>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/${id}/approve`,
        { feePaid, feeReceiptNumber },
        { withCredentials: true }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(
        data.data.message || "Payment successful. Admission approved"
      );
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
      queryClient.invalidateQueries({ queryKey: ["fee-payments"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.message || "Failed to process payment");
    },
  });

  const initiatePayment = async (payload: PaymentPayload): Promise<void> => {
    await approveMutation.mutateAsync(payload);
  };

  return {
    initiatePayment,
    isProcessing: approveMutation.isPending,
  };
};
