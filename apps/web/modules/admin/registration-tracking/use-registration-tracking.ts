"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse } from "@webcampus/types/api";
import axios from "axios";

export interface RegistrationTrackingRow {
  studentId: string;
  studentName: string;
  usn: string;
  studentEmail: string;
  isRegistered: boolean;
  registrationDate: string | null;
  registeredCourseCount: number;
}

export interface StudentRegisteredCourseRow {
  id: string;
  code: string;
  name: string;
  courseType: string;
  ltp: string;
  totalCredits: number;
}

export interface RegistrationTrackingFilters {
  academicTermId: string;
  semesterId: string;
  departmentId?: string;
  cycle?: "PHYSICS" | "CHEMISTRY";
  statusFilter?: "ALL" | "REGISTERED" | "PENDING";
}

export const useRegistrationTracking = (
  filters: RegistrationTrackingFilters,
  enabled: boolean
) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["admin-registration-tracking", filters],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<RegistrationTrackingRow[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/registration-tracking`,
        {
          params: {
            academicTermId: filters.academicTermId,
            semesterId: filters.semesterId,
            ...(filters.departmentId
              ? { departmentId: filters.departmentId }
              : {}),
            ...(filters.cycle ? { cycle: filters.cycle } : {}),
            ...(filters.statusFilter
              ? { statusFilter: filters.statusFilter }
              : {}),
          },
          withCredentials: true,
        }
      );

      if (res.data.status === "success") {
        return res.data.data || [];
      }

      return [];
    },
    enabled,
  });
};

export const useStudentRegisteredCourses = (
  studentId: string | undefined,
  semesterId: string | undefined,
  academicTermId: string | undefined
) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: [
      "admin-student-registered-courses",
      studentId,
      semesterId,
      academicTermId,
    ],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<StudentRegisteredCourseRow[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/registration-tracking/${studentId}/courses`,
        {
          params: { semesterId, academicTermId },
          withCredentials: true,
        }
      );

      if (res.data.status === "success") {
        return res.data.data || [];
      }

      return [];
    },
    enabled: !!studentId && !!semesterId && !!academicTermId,
  });
};
