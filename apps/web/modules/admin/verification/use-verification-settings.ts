"use client";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";

export interface VerificationSetting {
  id: string;
  academicTermId: string;
  enabled: boolean;
  windowStartAt: string | null;
  windowEndAt: string | null;
  updatedById: string | null;
  updatedAt: string;
  academicTerm?: { type: string; year: string };
}

export interface VerificationLogItem {
  id: string;
  studentId: string;
  academicTermId: string;
  token: string | null;
  verifiedById: string | null;
  verifiedByRole: string | null;
  result: string;
  detail: string | null;
  createdAt: string;
  student?: { usn: string } | null;
  academicTerm?: { type: string; year: string } | null;
}

const unwrapSuccess = <T>(response: BaseResponse<T>) => {
  if (response.status !== "success") throw new Error(response.message);
  return response.data;
};

const settingsQueryKey = ["verification-settings"] as const;
const logsQueryKey = ["verification-logs"] as const;

export const useVerificationSettings = () => {
  return useQuery({
    queryKey: settingsQueryKey,
    queryFn: async () => {
      const response = await apiClient.get<BaseResponse<VerificationSetting[]>>(
        "/verification/settings"
      );
      return unwrapSuccess(response.data) ?? [];
    },
  });
};

export const useUpsertVerificationSetting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      academicTermId: string;
      enabled: boolean;
      windowStartAt?: string | null;
      windowEndAt?: string | null;
    }) => {
      const response = await apiClient.patch<BaseResponse<VerificationSetting>>(
        "/verification/settings",
        params
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Verification setting saved");
      queryClient.invalidateQueries({ queryKey: settingsQueryKey });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to save setting"));
    },
  });
};

export const useVerificationLogs = (params?: {
  academicTermId?: string;
  result?: string;
  limit?: number;
}) => {
  return useQuery({
    queryKey: [logsQueryKey, params ?? {}],
    queryFn: async () => {
      const response = await apiClient.get<
        BaseResponse<{
          total: number;
          page: number;
          limit: number;
          items: VerificationLogItem[];
        }>
      >("/verification/logs", { params });
      return unwrapSuccess(response.data);
    },
  });
};
