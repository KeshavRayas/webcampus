"use client";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";

const studentHallTicketQueryKey = ["student-hall-tickets"] as const;

export interface HallTicketListItem {
  academicTermId: string;
  academicYear: string;
  currentSemester: number;
  isSent: boolean;
  sentAt: string | null;
  allCoursesFrozen: boolean;
  eligible: boolean;
}

export interface CourseEligibility {
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
}

export interface HallTicketData {
  studentId: string;
  usn: string;
  name: string;
  photo: string | null;
  departmentName: string;
  currentSemester: number;
  programType: string | null;
  academicTermLabel: string;
  sectionName: string | null;
  courses: CourseEligibility[];
  allCoursesFrozen: boolean;
  eligible: boolean;
  isSent: boolean;
  sentAt: string | null;
  sentBy: string | null;
  verificationToken: string | null;
}

const unwrapSuccess = <T>(response: BaseResponse<T>) => {
  if (response.status !== "success") throw new Error(response.message);
  return response.data;
};

export const useStudentHallTickets = () => {
  return useQuery({
    queryKey: studentHallTicketQueryKey,
    queryFn: async () => {
      const response = await apiClient.get<BaseResponse<HallTicketListItem[]>>(
        "/student/hall-ticket"
      );
      return unwrapSuccess(response.data);
    },
  });
};

export const useStudentHallTicketData = (academicTermId: string | null) => {
  return useQuery({
    queryKey: ["student-hall-ticket-data", academicTermId],
    queryFn: async () => {
      const response = await apiClient.get<
        BaseResponse<HallTicketData | { notAvailable: boolean; reason: string }>
      >(`/student/hall-ticket/${academicTermId}`);
      return unwrapSuccess(response.data) as
        | HallTicketData
        | { notAvailable: boolean; reason: string };
    },
    enabled: !!academicTermId,
  });
};

export const useRefreshHallTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (academicTermId: string) => {
      const response = await apiClient.get<
        BaseResponse<HallTicketData | { notAvailable: boolean; reason: string }>
      >(`/student/hall-ticket/${academicTermId}`);
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Hall ticket data refreshed");
      queryClient.invalidateQueries({ queryKey: studentHallTicketQueryKey });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to refresh hall ticket"));
    },
  });
};

export const downloadHallTicketPdf = async (academicTermId: string) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const response = await fetch(
    `${apiUrl}/student/hall-ticket/${academicTermId}/pdf`,
    { credentials: "include" }
  );
  if (!response.ok) throw new Error("Failed to download PDF");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hall-ticket-${academicTermId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
