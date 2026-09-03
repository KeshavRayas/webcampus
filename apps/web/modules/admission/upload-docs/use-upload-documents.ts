"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";

type UploadDocumentsPayload = {
  id: string;
  files: Record<string, File | null>;
};

export const useUploadDocuments = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ id, files }: UploadDocumentsPayload) => {
      const formData = new FormData();

      Object.entries(files).forEach(([field, file]) => {
        if (file) {
          formData.append(field, file);
        }
      });

      const response = await apiClient.patch<BaseResponse<unknown>>(
        `/admission/${id}/documents`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.status === "error") {
        throw new Error(response.data.message);
      }

      return response.data;
    },
    onSuccess: () => {
      toast.success("Admission documents uploaded successfully");
      queryClient.invalidateQueries({
        queryKey: ["upload-documents"],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to upload admission documents"
      );
    },
  });

  return {
    uploadDocuments: mutation.mutate,
    uploadDocumentsAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
};
