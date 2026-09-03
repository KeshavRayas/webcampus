"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import type { AcademicTermResponseType } from "@webcampus/schemas/admin";
import type { BaseResponse } from "@webcampus/types/api";

/**
 * Student-safe hook for fetching academic terms.
 * Reuses the same faculty/admin safe academic term endpoints or defaults safely.
 */
export const useStudentTerms = () => {
  return useQuery({
    queryKey: ["student-academic-terms"],
    queryFn: async () => {
      // Reusing the student attendance terms endpoint
      const res = await apiClient.get<BaseResponse<AcademicTermResponseType[]>>(
        `/student/attendance/terms`
      );
      if (res.data.status === "success" && "data" in res.data) {
        return res.data.data;
      }
      return [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};
