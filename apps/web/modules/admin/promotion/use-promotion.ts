"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse, ErrorResponse } from "@webcampus/types/api";
import axios, { AxiosError } from "axios";
import { toast } from "react-toastify";

export interface OutstandingBacklog {
  courseId: string;
  courseCode: string;
  courseName: string;
  outcome: string;
}

export interface PromotionCandidateItem {
  studentId: string;
  usn: string;
  name: string;
  departmentName: string;
  currentSemester: number;
}

export interface PromotionNonEligibleItem extends PromotionCandidateItem {
  reasons: string[];
  outstandingBacklogs: OutstandingBacklog[];
}

export interface PromotionCandidatesData {
  fromSemester: {
    id: string;
    semesterNumber: number;
    programType: string;
    academicTermLabel: string;
  };
  toSemester: {
    id: string;
    semesterNumber: number;
    programType: string;
    academicTermLabel: string;
  };
  eligible: PromotionCandidateItem[];
  nonEligible: PromotionNonEligibleItem[];
}

export interface PromotionHistoryItem {
  id: string;
  fromSemesterNumber: number;
  toSemesterNumber: number;
  notes: string | null;
  promotedAt: string;
  student: { id: string; usn: string; user: { name: string } };
  promotedBy: { name: string };
  academicTerm: { type: string; year: string };
}

export interface PromotionHistoryPayload {
  data: PromotionHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PromoteStudentsPayload {
  fromSemesterId: string;
  toSemesterId: string;
  studentIds: string[];
  notes?: string;
  academicYear?: string;
  promoteFirstYearSections?: boolean;
}

const API_ROOT = () =>
  `${frontendEnv().NEXT_PUBLIC_API_BASE_URL}/admin/promotion`;

export const usePromotionCandidates = (
  fromSemesterId?: string,
  toSemesterId?: string,
  enabled = false
) => {
  return useQuery({
    queryKey: ["admin-promotion-candidates", fromSemesterId, toSemesterId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<PromotionCandidatesData>>(
        `${API_ROOT()}/candidates`,
        {
          params: { fromSemesterId, toSemesterId },
          withCredentials: true,
        }
      );

      if (res.data.status === "success") {
        return res.data.data || null;
      }

      return null;
    },
    enabled: enabled && !!fromSemesterId && !!toSemesterId,
  });
};

export const usePromotionHistory = (
  params: { page: number; pageSize: number },
  enabled = true
) => {
  return useQuery({
    queryKey: ["admin-promotion-history", params],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<PromotionHistoryPayload>>(
        `${API_ROOT()}/history`,
        {
          params,
          withCredentials: true,
        }
      );

      if (res.data.status === "success") {
        return res.data.data || null;
      }

      return null;
    },
    enabled,
  });
};

export const usePromoteStudents = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: PromoteStudentsPayload) => {
      return axios.post<BaseResponse<{ promotedCount: number }>>(
        API_ROOT(),
        payload,
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["admin-promotion"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to promote students"
      );
    },
  });
};
