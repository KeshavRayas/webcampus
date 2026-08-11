"use client";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";

export interface EligibleStudent {
  studentId: string;
  usn: string;
  name: string;
  email: string | null;
  photo: string | null;
  academicTermLabel?: string;
  departmentName: string;
  currentSemester: number;
  programType: string | null;
  sectionName: string | null;
  allCoursesFrozen: boolean;
  eligible: boolean;
  isSent: boolean;
  sentAt: string | null;
  sentBy: string | null;
  verificationToken: string | null;
  courses: {
    courseAssignmentId: string;
    courseCode: string;
    courseName: string;
    courseType: string;
    credits: number;
    cieTotal: number | null;
    attendancePercentage: number | null;
    isFrozen: boolean;
    markEligible: boolean;
    attendanceEligible: boolean;
    eligible: boolean;
    reason?: string | null;
  }[];
}

const unwrapSuccess = <T>(response: BaseResponse<T>) => {
  if (response.status !== "success") throw new Error(response.message);
  return response.data;
};

const hallTicketsQueryKey = ["admin-hall-tickets"] as const;

export const useEligibleStudentsList = (filters?: Record<string, string>) => {
  return useQuery({
    queryKey: [...hallTicketsQueryKey, filters],
    queryFn: async () => {
      const response = await apiClient.get<BaseResponse<EligibleStudent[]>>(
        "/admin/hall-ticket",
        { params: filters }
      );
      return unwrapSuccess(response.data) ?? [];
    },
  });
};

export const useUnsendHallTickets = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      studentIds: string[];
      academicTermId: string;
      semesterId: string;
    }) => {
      const response = await apiClient.post<BaseResponse<{ updated: number }>>(
        "/admin/hall-ticket/unsend",
        params
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: (data) => {
      if (data && data.updated > 0) {
        toast.success(`Hall tickets unsent successfully`);
      } else {
        toast.info("No sent hall tickets to unsend.");
      }
      queryClient.invalidateQueries({ queryKey: hallTicketsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["student-hall-tickets"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to unsend hall tickets"));
    },
  });
};

export const useSendHallTickets = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      studentIds: string[];
      academicTermId: string;
      semesterId: string;
    }) => {
      const response = await apiClient.post<BaseResponse<null>>(
        "/admin/hall-ticket/send",
        params
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Hall tickets sent successfully");
      queryClient.invalidateQueries({ queryKey: hallTicketsQueryKey });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to send hall tickets"));
    },
  });
};

export const downloadHallTicketPdf = async (
  studentId: string,
  academicTermId: string
) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const response = await fetch(
    `${apiUrl}/admin/hall-ticket/${studentId}/${academicTermId}/pdf`,
    { credentials: "include" }
  );
  if (!response.ok) throw new Error("Failed to download PDF");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hall-ticket-${studentId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const useStudentHallTicketPreview = (
  studentId: string | null,
  academicTermId: string | null
) => {
  return useQuery({
    queryKey: ["hall-ticket-preview", studentId, academicTermId],
    queryFn: async () => {
      const response = await apiClient.get<BaseResponse<EligibleStudent>>(
        `/admin/hall-ticket/${studentId}/${academicTermId}`
      );
      return unwrapSuccess(response.data);
    },
    enabled: !!studentId && !!academicTermId,
  });
};
