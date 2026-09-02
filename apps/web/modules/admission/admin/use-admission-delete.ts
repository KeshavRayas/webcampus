"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import type { AxiosError, AxiosResponse } from "axios";
import { toast } from "react-toastify";

export const useAdmissionDelete = () => {
  const queryClient = useQueryClient();

  const { mutate: deleteAdmission } = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.delete(`/admission/${id}`);
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data.error || "Failed to delete admission");
    },
  });

  const onDelete = (id: string) => {
    deleteAdmission(id);
  };

  return { onDelete };
};
