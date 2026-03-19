"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { toast } from "react-toastify";

type PortStudentsPayload = {
  semesterId: string;
};

type PortStudentsResult = {
  semesterId: string;
  semesterNumber: number;
  totalApproved: number;
  newlyPorted: number;
  alreadyPorted: number;
  autoCreatedApplicants?: number;
  rejectedCount: number;
};

export const usePortStudents = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: PortStudentsPayload) => {
      return await axios.post<SuccessResponse<PortStudentsResult>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/port`,
        payload,
        { withCredentials: true }
      );
    },
    onSuccess: (response: AxiosResponse<SuccessResponse<PortStudentsResult>>) => {
      const result = response.data.data;
      if (result) {
        const autoCreated = result.autoCreatedApplicants ?? 0;
        toast.success(
          autoCreated > 0
            ? `Port completed. New: ${result.newlyPorted}, already ported: ${result.alreadyPorted}, applicant users auto-created: ${autoCreated}.`
            : `Port completed. New: ${result.newlyPorted}, already ported: ${result.alreadyPorted}.`
        );
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
