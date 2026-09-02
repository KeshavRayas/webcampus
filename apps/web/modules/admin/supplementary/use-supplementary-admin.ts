"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse, ErrorResponse } from "@webcampus/types/api";
import axios, { AxiosError } from "axios";
import { toast } from "react-toastify";

export interface SupplementaryOfferingItem {
  id: string;
  academicTermId: string;
  courseId: string;
  code: string;
  name: string;
  courseType: string;
  totalCredits: number;
}

export interface SupplementaryRegistrationItem {
  id: string;
  studentId: string;
  usn: string;
  studentName: string;
  courseId: string;
  code: string;
  courseName: string;
  totalCredits: number;
  semesterLabel: string;
  registrationDate: string;
}

export interface SupplementarySectionItem {
  id: string;
  name: string;
  offeringId: string;
  courseId: string;
  courseCode: string;
  semesterId: string;
  semesterNumber: number;
  programType: string;
  academicTermLabel: string;
  studentCount: number;
  courses: {
    id: string;
    code: string;
    name: string;
    facultyName: string | null;
  }[];
}

export interface SupplementaryDemandSectionSummary {
  id: string;
  name: string;
  studentCount: number;
  facultyNames: string[];
}

export interface SupplementaryDemandRow {
  offeringId: string;
  courseId: string;
  code: string;
  name: string;
  courseType: string;
  totalCredits: number;
  semesterNumber: number;
  programType: string;
  activeRegistrationCount: number;
  lastTaughtBy: string[];
  sections: SupplementaryDemandSectionSummary[];
  windowOpen: boolean;
}

export interface ApprovedCourseOption {
  id: string;
  code: string;
  name: string;
  courseType?: string;
  approvalStatus?: string;
}

const API_ROOT = () =>
  `${frontendEnv().NEXT_PUBLIC_API_BASE_URL}/admin/supplementary`;

export const useSupplementaryOfferings = (academicTermId?: string) => {
  return useQuery({
    queryKey: ["admin-supplementary-offerings", academicTermId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<SupplementaryOfferingItem[]>>(
        `${API_ROOT()}/terms/${academicTermId}/offerings`,
        { withCredentials: true }
      );

      if (res.data.status === "success") {
        return res.data.data || [];
      }

      return [];
    },
    enabled: !!academicTermId,
  });
};

export const useSupplementaryRegistrations = (
  academicTermId?: string,
  courseId?: string
) => {
  return useQuery({
    queryKey: ["admin-supplementary-registrations", academicTermId, courseId],
    queryFn: async () => {
      const res = await axios.get<
        BaseResponse<SupplementaryRegistrationItem[]>
      >(`${API_ROOT()}/registrations`, {
        params: { academicTermId, ...(courseId ? { courseId } : {}) },
        withCredentials: true,
      });

      if (res.data.status === "success") {
        return res.data.data || [];
      }

      return [];
    },
    enabled: !!academicTermId,
  });
};

export const useSupplementaryDemand = (academicTermId?: string) => {
  return useQuery({
    queryKey: ["admin-supplementary-demand", academicTermId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<SupplementaryDemandRow[]>>(
        `${API_ROOT()}/terms/${academicTermId}/demand`,
        { withCredentials: true }
      );

      if (res.data.status === "success") {
        return res.data.data || [];
      }

      return [];
    },
    enabled: !!academicTermId,
  });
};

export const useSupplementarySections = (offeringId?: string) => {
  return useQuery({
    queryKey: ["admin-supplementary-sections", offeringId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<SupplementarySectionItem[]>>(
        `${API_ROOT()}/offerings/${offeringId}/sections`,
        { withCredentials: true }
      );

      if (res.data.status === "success") {
        return res.data.data || [];
      }

      return [];
    },
    enabled: !!offeringId,
  });
};

export const useCreateSupplementarySection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { offeringId: string; name: string }) => {
      const { offeringId, ...body } = payload;

      return axios.post<BaseResponse<SupplementarySectionItem>>(
        `${API_ROOT()}/offerings/${offeringId}/sections`,
        body,
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-supplementary-sections"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message ||
          "Failed to create supplementary section"
      );
    },
  });
};

export const useAssignSupplementaryStudents = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      sectionId: string;
      studentIds: string[];
    }) => {
      const { sectionId, ...body } = payload;

      return axios.post<BaseResponse<{ placedCount: number }>>(
        `${API_ROOT()}/sections/${sectionId}/students`,
        body,
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      const payload = res.data;
      const placedCount =
        "data" in payload && payload.data ? payload.data.placedCount : 0;

      toast.success(`${payload.message} (${placedCount} placed)`);
      queryClient.invalidateQueries({
        queryKey: ["admin-supplementary-sections"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message ||
          "Failed to assign students to supplementary section"
      );
    },
  });
};

export const useSupplementaryCandidateCourses = (
  departmentId?: string,
  parity?: string | null,
  programType?: string
) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: [
      "supplementary-candidate-courses",
      departmentId,
      parity ?? null,
      programType ?? null,
    ],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<ApprovedCourseOption[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course/supplementary-candidates`,
        {
          params: {
            departmentId,
            ...(parity ? { parity } : {}),
            ...(programType ? { programType } : {}),
          },
          withCredentials: true,
        }
      );

      if (res.data.status === "success") {
        return (res.data.data || []).filter(
          (course) =>
            !course.approvalStatus || course.approvalStatus === "APPROVED"
        );
      }

      return [];
    },
    enabled: !!departmentId,
  });
};

export const useAddSupplementaryOffering = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      academicTermId: string;
      courseId: string;
    }) => {
      return axios.post<BaseResponse<SupplementaryOfferingItem>>(
        `${API_ROOT()}/offerings`,
        payload,
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-supplementary-offerings"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to add supplementary offering"
      );
    },
  });
};

export const useDeleteSupplementaryOffering = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return axios.delete<BaseResponse<null>>(`${API_ROOT()}/offerings/${id}`, {
        withCredentials: true,
      });
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-supplementary-offerings"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message ||
          "Failed to remove supplementary offering"
      );
    },
  });
};
