"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChangeAdmissionModeType } from "@webcampus/schemas/admission";
import { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";

type ChangeAdmissionModePayload = {
  modeOfAdmission: string;
  categoryClaimed: string;
  categoryAllotted: string;
  quota: ChangeAdmissionModeType["quota"];
  entranceExamRank?: number | null;
  originalAdmissionOrderNumber?: string;
  originalAdmissionOrderDate?: string;
};

export const useChangeAdmissionMode = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: ChangeAdmissionModePayload;
    }) => {
      const res = await apiClient.patch<BaseResponse<unknown>>(
        `/admission/${id}/change-mode`,
        data
      );

      if (res.data.status === "error") {
        throw new Error(res.data.message);
      }

      return res.data;
    },

    onSuccess: () => {
      toast.success("Admission updated successfully");

      queryClient.invalidateQueries({
        queryKey: ["change-admission-mode"],
      });

      queryClient.invalidateQueries({
        queryKey: ["admissions"],
      });
    },

    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update admission"
      );
    },
  });

  return {
    changeAdmissionMode: mutation.mutate,
    changeAdmissionModeAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
};
