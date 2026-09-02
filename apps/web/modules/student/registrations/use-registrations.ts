"use client";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExamRegistrationEligibilityType,
  ExamRegistrationHistoryItemType,
  ReRegistrationEligibilityType,
  ReRegistrationHistoryItemType,
  SubmitExamRegistrationType,
  SubmitReRegistrationType,
  SubmitSupplementaryType,
  SupplementaryEligibilityType,
  SupplementaryHistoryItemType,
} from "@webcampus/schemas/student";
import { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";

const unwrapSuccess = <T>(response: BaseResponse<T>) => {
  if (response.status !== "success") {
    throw new Error(response.message);
  }
  return response.data;
};

const reRegistrationKey = ["student-re-registration"] as const;
const supplementaryKey = ["student-supplementary-registration"] as const;
const examRegistrationKey = ["student-exam-registration"] as const;

export const useReRegistrationEligibility = () => {
  return useQuery({
    queryKey: [...reRegistrationKey, "eligible"],
    queryFn: async () => {
      const response = await apiClient.get<
        BaseResponse<ReRegistrationEligibilityType>
      >("/student/re-registration/eligible");
      return unwrapSuccess(response.data);
    },
  });
};

export const useSubmitReRegistration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SubmitReRegistrationType) => {
      const response = await apiClient.post<BaseResponse<unknown>>(
        "/student/re-registration/submit",
        payload
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Re-registration submitted successfully");
      queryClient.invalidateQueries({ queryKey: reRegistrationKey });
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to submit re-registration")
      );
    },
  });
};

export const useReRegistrationHistory = () => {
  return useQuery({
    queryKey: [...reRegistrationKey, "history"],
    queryFn: async () => {
      const response = await apiClient.get<
        BaseResponse<ReRegistrationHistoryItemType[]>
      >("/student/re-registration/history");
      return unwrapSuccess(response.data);
    },
  });
};

export const useSupplementaryEligibility = () => {
  return useQuery({
    queryKey: [...supplementaryKey, "eligible"],
    queryFn: async () => {
      const response = await apiClient.get<
        BaseResponse<SupplementaryEligibilityType>
      >("/student/supplementary/eligible");
      return unwrapSuccess(response.data);
    },
  });
};

export const useSubmitSupplementary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SubmitSupplementaryType) => {
      const response = await apiClient.post<BaseResponse<unknown>>(
        "/student/supplementary/submit",
        payload
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Supplementary registration submitted successfully");
      queryClient.invalidateQueries({ queryKey: supplementaryKey });
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to submit supplementary registration")
      );
    },
  });
};

export const useSupplementaryHistory = () => {
  return useQuery({
    queryKey: [...supplementaryKey, "history"],
    queryFn: async () => {
      const response = await apiClient.get<
        BaseResponse<SupplementaryHistoryItemType[]>
      >("/student/supplementary/history");
      return unwrapSuccess(response.data);
    },
  });
};

export const useExamRegistrationEligibility = () => {
  return useQuery({
    queryKey: [...examRegistrationKey, "eligible"],
    queryFn: async () => {
      const response = await apiClient.get<
        BaseResponse<ExamRegistrationEligibilityType>
      >("/student/exam-registration/eligible");
      return unwrapSuccess(response.data);
    },
  });
};

export const useSubmitExamRegistration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SubmitExamRegistrationType) => {
      const response = await apiClient.post<BaseResponse<unknown>>(
        "/student/exam-registration/submit",
        payload
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Examination registration submitted successfully");
      queryClient.invalidateQueries({ queryKey: examRegistrationKey });
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to submit examination registration")
      );
    },
  });
};

export const useExamRegistrationHistory = () => {
  return useQuery({
    queryKey: [...examRegistrationKey, "history"],
    queryFn: async () => {
      const response = await apiClient.get<
        BaseResponse<ExamRegistrationHistoryItemType[]>
      >("/student/exam-registration/history");
      return unwrapSuccess(response.data);
    },
  });
};
