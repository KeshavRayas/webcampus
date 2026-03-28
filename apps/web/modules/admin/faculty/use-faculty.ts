import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { ErrorResponse } from "@webcampus/types/api";
import axios, { AxiosError } from "axios";
import { toast } from "react-toastify";

const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

export const useUpdateFaculty = (departmentId: string) => {
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
        formData.append(key, String(value));
      });

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const res = await axios.put(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/faculty/${id}`,
        formData,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await axios.delete(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/faculty/${id}`,
        { withCredentials: true }
      );
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
      const res = await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/faculty/${id}/hod`,
        { ...data, departmentId },
        { withCredentials: true }
      );
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hodId }: { id: string; hodId: string }) => {
      const res = await axios.put(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/faculty/${id}/hod`,
        { hodId },
        { withCredentials: true }
      );
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
