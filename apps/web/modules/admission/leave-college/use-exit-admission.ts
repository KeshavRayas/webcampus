"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";

export const useExitAdmission = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      cancellationReason?: string;
      cancellationDescription?: string;
    }) => {
      const res = await apiClient.patch<BaseResponse<unknown>>(
        `/admission/${payload.id}/exit`,
        {
          cancellationReason: payload.cancellationReason,
          cancellationDescription: payload.cancellationDescription,
        },
        {
          withCredentials: true,
        }
      );

      if (res.data.status === "error") {
        throw new Error(res.data.message);
      }

      return res.data;
    },

    onSuccess: () => {
      toast.success("Student marked as exited successfully");

      queryClient.invalidateQueries({
        queryKey: ["leave-college-admissions"],
      });

      queryClient.invalidateQueries({
        queryKey: ["admissions"],
      });
    },

    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to exit student"
      );
    },
  });

  return {
    exitAdmission: (
      payload: {
        id: string;
        cancellationReason?: string;
        cancellationDescription?: string;
      },
      options?: Parameters<typeof mutation.mutate>[1]
    ) => mutation.mutate(payload, options),
    exitAdmissionAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
};
