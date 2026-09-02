"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse } from "@webcampus/types/api";
import axios from "axios";

export interface ExamRegistrationListItem {
  id: string;
  usn: string;
  studentName: string;
  courseId: string;
  code: string;
  courseName: string;
  academicTermId: string;
  examType: string;
  attemptNumber: number;
  status: string;
  outcome: string | null;
  seeMarks: number | null;
  maxSeeMarks: number | null;
  eligibleAtRegistration: boolean;
  registeredAt: string;
}

export interface ExamRegistrationsPayload {
  data: ExamRegistrationListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ExamRegistrationsQuery {
  academicTermId: string;
  courseId?: string;
  examType?: "REGULAR" | "REAPPEAR" | "SUPPLEMENTARY" | "MAKE_UP";
  status?: "REGISTERED" | "SEATED" | "RESULT_DECLARED" | "CANCELLED";
  page?: number;
  pageSize?: number;
}

export const useExamRegistrations = (
  query: ExamRegistrationsQuery,
  enabled = false
) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["admin-exam-registrations", query],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<ExamRegistrationsPayload>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/exam-registration`,
        {
          params: query,
          withCredentials: true,
        }
      );

      if (res.data.status === "success") {
        return res.data.data || null;
      }

      return null;
    },
    enabled: enabled && !!query.academicTermId,
  });
};
