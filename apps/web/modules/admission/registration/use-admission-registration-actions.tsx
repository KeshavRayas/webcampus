"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { ErrorResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { toast } from "react-toastify";

export const useAdmissionRegistrationActions = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const { mutate: deleteAdmission } = useMutation({
    mutationFn: async (id: number) => {
      return await axios.delete(`${NEXT_PUBLIC_API_BASE_URL}/admission`, {
        data: { id },
        withCredentials: true,
      });
    },
    onSuccess: (data: AxiosResponse<{ status: string; message: string }>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data.error);
    },
  });

  return { deleteAdmission };
};
