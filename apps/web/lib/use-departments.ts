"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  type?: "DEGREE_GRANTING" | "BASIC_SCIENCES" | "SERVICE";
}

/**
 * Fetches all departments from the backend.
 * Data is cached for 5 minutes (staleTime: 5 * 60 * 1000).
 */
export const useDepartments = () => {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res =
        await apiClient.get<BaseResponse<DepartmentOption[]>>(
          `/admin/department`
        );
      if (res.data.status === "success") {
        return res.data.data || [];
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Fetches departments available for admission workflows.
 * Backend already limits this list to degree-granting departments.
 */
export const useAdmissionDepartments = () => {
  return useQuery({
    queryKey: ["admission-departments"],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<DepartmentOption[]>>(
        `/admission/departments`
      );
      if (res.data.status === "success") {
        return res.data.data || [];
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
  });
};
