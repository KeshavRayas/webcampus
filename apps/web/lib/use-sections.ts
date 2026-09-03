"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";

export interface SectionOption {
  id: string;
  name: string;
  departmentId: string;
  semesterId: string;
  cycle: "PHYSICS" | "CHEMISTRY" | "NONE";
}

export const useSections = (
  semesterId?: string,
  departmentId?: string,
  cycle?: string
) => {
  return useQuery({
    queryKey: ["sections", semesterId, departmentId, cycle],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (semesterId) params.semesterId = semesterId;
      if (departmentId) params.departmentId = departmentId;
      if (cycle) params.cycle = cycle;

      const res = await apiClient.get<BaseResponse<SectionOption[]>>(
        `/admin/sections`,
        { params }
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
