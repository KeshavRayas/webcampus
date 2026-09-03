import { apiClient } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorResponse } from "@webcampus/types/api";
import type { AxiosError } from "axios";
import { toast } from "react-toastify";

export const useUpdateFaculty = (departmentId: string) => {
  void departmentId;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
      imageFile,
    }: {
      id: string;
      data: Record<string, unknown>;
      imageFile?: File | null;
    }) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const res = await apiClient.put(`/admin/faculty/${id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["admin-faculty"] });
    },
    onError: (err: AxiosError<ErrorResponse>) => {
      toast.error(err.response?.data?.message || err.message);
    },
  });
};

export const useDeleteFaculty = (departmentId: string) => {
  void departmentId;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/admin/faculty/${id}`);
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["admin-faculty"] });
    },
    onError: (err: AxiosError<ErrorResponse>) => {
      toast.error(err.response?.data?.message || err.message);
    },
  });
};

export const useCreateHodAccount = (departmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => {
      const res = await apiClient.post(`/admin/faculty/${id}/hod`, {
        ...data,
        departmentId,
      });
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["admin-faculty"] });
    },
    onError: (err: AxiosError<ErrorResponse>) => {
      toast.error(err.response?.data?.message || err.message);
    },
  });
};

export const useReassignHodAccount = (departmentId: string) => {
  void departmentId;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hodId }: { id: string; hodId: string }) => {
      const res = await apiClient.put(`/admin/faculty/${id}/hod`, { hodId });
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["admin-faculty"] });
    },
    onError: (err: AxiosError<ErrorResponse>) => {
      toast.error(err.response?.data?.message || err.message);
    },
  });
};
