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
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => {
      const res = await axios.put(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/faculty/${id}`,
        data,
        { withCredentials: true }
      );
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-faculty", departmentId],
      });
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
      queryClient.invalidateQueries({
        queryKey: ["admin-faculty", departmentId],
      });
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
      queryClient.invalidateQueries({
        queryKey: ["admin-faculty", departmentId],
      });
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
      queryClient.invalidateQueries({
        queryKey: ["admin-faculty", departmentId],
      });
    },
    onError: (err: AxiosError<ErrorResponse>) => {
      toast.error(err.response?.data?.message || err.message);
    },
  });
};
