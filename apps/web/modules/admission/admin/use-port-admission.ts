"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { toast } from "react-toastify";

export const usePortAdmission = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      return await axios.post<SuccessResponse<null>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/${id}/port`,
        {},
        { withCredentials: true }
      );
    },
    onSuccess: (response: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(response.data.message || "Student posted successfully");
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
      queryClient.invalidateQueries({ queryKey: ["department-students"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.message || "Failed to post student");
    },
  });

  return {
    onPortAdmission: mutation.mutate,
    isPorting: mutation.isPending,
  };
};
