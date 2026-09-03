"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import type { AxiosError, AxiosResponse } from "axios";
import { toast } from "react-toastify";

type PortStudentsPayload = {
  semesterId: string;
  admissionIds?: string[];
};

type PortStudentsResult = {
  semesterId: string;
  semesterNumber: number;
  totalApproved: number;
  newlyPorted: number;
  alreadyPorted: number;
  autoCreatedApplicants?: number;
  rejectedCount: number;
  failedPorts?: { applicationId: string; reason: string }[];
};

export const usePortStudents = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: PortStudentsPayload) => {
      return await apiClient.post<SuccessResponse<PortStudentsResult>>(
        `/admission/port`,
        payload
      );
    },
    onSuccess: (
      response: AxiosResponse<SuccessResponse<PortStudentsResult>>
    ) => {
      const result = response.data.data;
      if (result) {
        const autoCreated = result.autoCreatedApplicants ?? 0;
        const failedPorts = result.failedPorts ?? [];
        if (failedPorts.length > 0) {
          const reasons = Array.from(
            new Set(failedPorts.map((failure) => failure.reason))
          )
            .slice(0, 3)
            .join("; ");
          toast.error(
            `Port completed with ${failedPorts.length} failure(s). ${reasons}`
          );
        } else {
          toast.success(
            autoCreated > 0
              ? `Port completed. New: ${result.newlyPorted}, already ported: ${result.alreadyPorted}, applicant users auto-created: ${autoCreated}.`
              : `Port completed. New: ${result.newlyPorted}, already ported: ${result.alreadyPorted}.`
          );
        }
      } else {
        toast.success(response.data.message || "Students ported successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["admissions"] });
      queryClient.invalidateQueries({ queryKey: ["department-students"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.message || "Failed to port students");
    },
  });

  return {
    onPortStudents: mutation.mutate,
    isPorting: mutation.isPending,
  };
};
