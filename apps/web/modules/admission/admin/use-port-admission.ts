"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";

export const usePortAdmission = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const response = await apiClient.post<BaseResponse<unknown>>(
        `/admission/${id}/port`
      );

      if (response.data.status === "error") {
        throw new Error(response.data.message);
      }

      return response.data;
    },
    onSuccess: () => {
      toast.success("Admission ported to students successfully.");
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
      queryClient.invalidateQueries({ queryKey: ["department-students"] });
      queryClient.invalidateQueries({ queryKey: ["cancel-admissions"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to port admission"
      );
    },
  });

  return {
    portAdmission: mutation.mutate,
    isPorting: mutation.isPending,
  };
};
