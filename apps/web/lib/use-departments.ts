"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse } from "@webcampus/types/api";
import axios from "axios";

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  type?: "DEGREE_GRANTING" | "BASIC_SCIENCES" | "SERVICE";
}

/**
 * Fetches all departments from the backend.
 * Data is always kept fresh (staleTime: 0) and automatically refetches on window focus.
 */
export const useDepartments = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<DepartmentOption[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/department`,
        { withCredentials: true }
      );
      if (res.data.status === "success") {
        return res.data.data || [];
      }
      return [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};

/**
 * Fetches departments available for admission workflows.
 * Backend already limits this list to degree-granting departments.
 */
export const useAdmissionDepartments = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["admission-departments"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<DepartmentOption[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/departments`,
        { withCredentials: true }
      );
      if (res.data.status === "success") {
        return res.data.data || [];
      }
      return [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};
