"use client";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useMutation } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";

export interface VerificationCourse {
  courseCode: string;
  courseName: string;
  courseType: string;
  credits: number;
  cieTotal: number | null;
  attendancePercentage: number | null;
  eligible: boolean;
  reason: string | null;
}

export interface VerificationStudent {
  studentId: string;
  usn: string;
  name: string;
  photo: string | null;
  departmentName: string;
  currentSemester: number;
  programType: string | null;
  academicTermLabel: string;
  sectionName: string | null;
  isSent: boolean;
}

export interface VerificationResultData {
  valid: boolean;
  result: string;
  detail: string | null;
  student: VerificationStudent | null;
  courses?: VerificationCourse[];
}

const unwrapSuccess = <T>(response: BaseResponse<T>) => {
  if (response.status !== "success") throw new Error(response.message);
  return response.data;
};

export const useVerifyHallTicket = () => {
  return useMutation({
    mutationFn: async (params: { token: string }) => {
      const response = await apiClient.post<
        BaseResponse<VerificationResultData>
      >("/verification/verify", params);
      return unwrapSuccess(response.data);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to verify hall ticket"));
    },
  });
};
