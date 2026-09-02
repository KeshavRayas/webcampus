"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";

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
  return useQuery({
    queryKey: ["admin-registration-tracking", filters],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<RegistrationTrackingRow[]>>(
        `/admin/registration-tracking`,
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
  return useQuery({
    queryKey: [
      "admin-student-registered-courses",
      studentId,
      semesterId,
      academicTermId,
    ],
    queryFn: async () => {
      const res = await apiClient.get<
        BaseResponse<StudentRegisteredCourseRow[]>
      >(`/admin/registration-tracking/${studentId}/courses`, {
        params: { semesterId, academicTermId },
      });

      if (res.data.status === "success") {
        return res.data.data || [];
      }

      return [];
    },
    enabled: !!studentId && !!semesterId && !!academicTermId,
  });
};
