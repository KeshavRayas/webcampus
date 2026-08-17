"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BaseResponse } from "@webcampus/types/api";
import type { Notice, NoticeInput } from "./notice-types";

const read = (response: BaseResponse<Notice[]>) => {
  if (response.status !== "success") throw new Error(response.message);
  return response.data ?? [];
};
export const useDepartmentNotices = () =>
  useQuery({
    queryKey: ["department-notices"],
    queryFn: async () =>
      read(
        (await apiClient.get<BaseResponse<Notice[]>>("/notices/department"))
          .data
      ),
  });
export const useStudentNotices = () =>
  useQuery({
    queryKey: ["student-notices"],
    queryFn: async () =>
      read(
        (await apiClient.get<BaseResponse<Notice[]>>("/notices/student")).data
      ),
  });
export const useFacultyNotices = () =>
  useQuery({
    queryKey: ["faculty-notices"],
    queryFn: async () =>
      read(
        (await apiClient.get<BaseResponse<Notice[]>>("/notices/faculty")).data
      ),
  });
export const useNoticeMutations = () => {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["department-notices"] });
  };
  return {
    create: useMutation({
      mutationFn: (input: NoticeInput) =>
        apiClient.post("/notices/department", input),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        input,
      }: {
        id: string;
        input: Partial<NoticeInput>;
      }) => apiClient.put(`/notices/department/${id}`, input),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => apiClient.delete(`/notices/department/${id}`),
      onSuccess: refresh,
    }),
    setStatus: useMutation({
      mutationFn: ({
        id,
        status,
      }: {
        id: string;
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      }) => apiClient.patch(`/notices/department/${id}/status`, { status }),
      onSuccess: refresh,
    }),
  };
};
