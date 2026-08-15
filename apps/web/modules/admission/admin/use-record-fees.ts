"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { toast } from "react-toastify";

export const useRecordFees = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      feePaid: number;
      receiptNo?: string;
      dateOfAdmission?: string;
      feeReceipt?: File | null;
    }) => {
      const formData = new FormData();
      formData.append("feePaid", String(payload.feePaid));
      if (payload.receiptNo) {
        formData.append("receiptNo", payload.receiptNo);
      }
      if (payload.dateOfAdmission) {
        formData.append("dateOfAdmission", payload.dateOfAdmission);
      }
      if (payload.feeReceipt) {
        formData.append("feeReceipt", payload.feeReceipt);
      }

      return await axios.post<SuccessResponse<null>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/${payload.id}/fees`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
    },
    onSuccess: (response: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(response.data.message || "Fee payment recorded");
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to record fee payment"
      );
    },
  });

  return {
    onRecordFees: mutation.mutate,
    isRecordingFees: mutation.isPending,
  };
};
