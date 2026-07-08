"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse } from "@webcampus/types/api";
import axios from "axios";

export interface SectionOption {
  id: string;
  name: string;
  departmentId: string;
  semesterId: string;
}

export const useSections = (semesterId?: string, departmentId?: string) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["sections", semesterId, departmentId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (semesterId) params.semesterId = semesterId;
      if (departmentId) params.departmentId = departmentId;

      const res = await axios.get<BaseResponse<SectionOption[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/sections`,
        { params, withCredentials: true }
      );
      if (res.data.status === "success") {
        return res.data.data || [];
      }
      return [];
    },
    enabled: !!semesterId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};
