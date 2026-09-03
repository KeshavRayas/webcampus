"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import type { AxiosError, AxiosResponse } from "axios";
import { toast } from "react-toastify";

export const useDepartmentDelete = () => {
  const queryClient = useQueryClient();

  const { mutate: deleteDepartment } = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.delete(`/admin/department/${id}`);
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["department"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data.error || "Failed to delete department");
    },
  });

  const onDelete = (id: string) => {
    deleteDepartment(id);
  };

  return { onDelete };
};
