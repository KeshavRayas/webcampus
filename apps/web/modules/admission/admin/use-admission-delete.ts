"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { toast } from "react-toastify";

export const useAdmissionDelete = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const { mutate: deleteAdmission } = useMutation({
    mutationFn: async (id: string) => {
      return await axios.delete(`${NEXT_PUBLIC_API_BASE_URL}/admission/${id}`, {
        withCredentials: true,
      });
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
