"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import type { AcademicTermResponseType } from "@webcampus/schemas/admin";
import type { BaseResponse } from "@webcampus/types/api";

/**
 * Faculty-safe hook for fetching academic terms.
 * Hits GET /faculty/assessment/terms (faculty-protected) instead of /admin/semester.
 */
export const useFacultyAcademicTerms = () => {
  return useQuery({
    queryKey: ["faculty-academic-terms"],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<AcademicTermResponseType[]>>(
        `/faculty/assessment/terms`
      );
      if (res.data.status === "success") {
        return res.data.data;
      }
      return [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};
