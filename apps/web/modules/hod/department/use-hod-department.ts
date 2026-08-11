"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import axios from "axios";

export interface HODDepartmentInfo {
  departmentId: string;
  departmentName: string;
  departmentType: string;
}

export const useHODDepartment = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["hod-department"],
    queryFn: async (): Promise<HODDepartmentInfo> => {
      const res = await axios.get(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/department`,
        { withCredentials: true }
      );
      return res.data.data;
    },
  });
};
