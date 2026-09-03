"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";

export interface HODDepartmentInfo {
  departmentId: string;
  departmentName: string;
  departmentType: string;
}

export const useHODDepartment = () => {
  return useQuery({
    queryKey: ["hod-department"],
    queryFn: async (): Promise<HODDepartmentInfo> => {
      const res = await apiClient.get(`/hod/department`);
      return res.data.data;
    },
  });
};
