"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";

export type CancellationReason =
  | "LEAVE_COLLEGE"
  | "CHANGE_ADMISSION_MODE"
  | "OTHER";

export const useCancelAdmission = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({
      id,
      reason,
      otherReason,
    }: {
      id: string;
      reason: CancellationReason;
      otherReason?: string;
    }) => {
      const response = await apiClient.patch<BaseResponse<unknown>>(
        `/admission/${id}/cancel`,
        { reason, otherReason },
        { withCredentials: true }
      );

      if (response.data.status === "error") {
        throw new Error(response.data.message);
      }

      return response.data;
    },
    onSuccess: () => {
      toast.success("Admission cancelled successfully");
      queryClient.invalidateQueries({ queryKey: ["cancel-admissions"] });
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel admission"
      );
    },
  });

  return {
    cancelAdmission: mutation.mutate,
    isPending: mutation.isPending,
  };
};
