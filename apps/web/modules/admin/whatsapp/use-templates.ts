"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import type { AxiosError } from "axios";
import { isAxiosError } from "axios";
import { toast } from "react-toastify";
import type {
  CourseOption,
  FieldSourceOption,
  MessageCategory,
  MessageRecipientType,
  MessageTemplate,
  PreviewResult,
  SendConfig,
  SendResult,
  TemplateFormValues,
} from "./types";

const apiBase = () => frontendEnv().NEXT_PUBLIC_API_BASE_URL;

const errorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    return (
      (error as AxiosError<{ message?: string }>).response?.data?.message ||
      fallback
    );
  }
  return fallback;
};

export const useMessageTemplates = (filters?: {
  category?: MessageCategory;
  recipientType?: MessageRecipientType;
  includeInactive?: boolean;
}) => {
  return useQuery({
    queryKey: ["whatsapp-templates", filters ?? {}],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.category) params.category = filters.category;
      if (filters?.recipientType) params.recipientType = filters.recipientType;
      if (filters?.includeInactive) params.includeInactive = "true";
      const res = await apiClient.get<{
        status: string;
        data: MessageTemplate[];
      }>(`${apiBase()}/admin/whatsapp/templates`, { params });
      return res.data.data ?? [];
    },
  });
};

export const useTemplateFieldSources = (category: MessageCategory | null) => {
  return useQuery({
    queryKey: ["whatsapp-template-fields", category],
    queryFn: async () => {
      const res = await apiClient.get<{
        status: string;
        data: FieldSourceOption[];
      }>(`${apiBase()}/admin/whatsapp/templates/fields`, {
        params: { category },
      });
      return res.data.data ?? [];
    },
    enabled: Boolean(category),
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      const res = await apiClient.post(
        `${apiBase()}/admin/whatsapp/templates`,
        data
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success("Message template created");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Failed to create template")),
  });
};

export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: TemplateFormValues;
    }) => {
      const res = await apiClient.put(
        `${apiBase()}/admin/whatsapp/templates/${id}`,
        data
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success("Message template updated");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Failed to update template")),
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(
        `${apiBase()}/admin/whatsapp/templates/${id}`
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success("Message template deleted");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Failed to delete template")),
  });
};

export const useWhatsAppCourses = (
  semesterId: string | undefined,
  departmentId: string | undefined
) => {
  return useQuery({
    queryKey: ["whatsapp-courses", semesterId, departmentId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (semesterId) params.semesterId = semesterId;
      if (departmentId) params.departmentId = departmentId;
      const res = await apiClient.get<{ status: string; data: CourseOption[] }>(
        `${apiBase()}/admin/whatsapp/courses`,
        { params }
      );
      return res.data.data ?? [];
    },
    enabled: Boolean(semesterId),
  });
};

export const useSendPreview = () => {
  return useMutation({
    mutationFn: async (config: SendConfig): Promise<PreviewResult> => {
      const res = await apiClient.post<{ status: string; data: PreviewResult }>(
        `${apiBase()}/admin/whatsapp/preview`,
        config
      );
      if (res.data.status !== "success" || !res.data.data) {
        throw new Error("Failed to generate preview");
      }
      return res.data.data;
    },
  });
};

export const useSendMessage = () => {
  return useMutation({
    mutationFn: async (config: SendConfig): Promise<SendResult> => {
      const res = await apiClient.post<{ status: string; data: SendResult }>(
        `${apiBase()}/admin/whatsapp/send`,
        config
      );
      if (res.data.status !== "success" || !res.data.data) {
        throw new Error("Failed to send messages");
      }
      return res.data.data;
    },
  });
};
