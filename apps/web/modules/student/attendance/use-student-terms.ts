"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import type { AcademicTermResponseType } from "@webcampus/schemas/admin";
import type { BaseResponse } from "@webcampus/types/api";
import axios from "axios";

/**
 * Student-safe hook for fetching academic terms.
 * Reuses the same faculty/admin safe academic term endpoints or defaults safely.
 */
export const useStudentTerms = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["student-academic-terms"],
    queryFn: async () => {
      // Reusing the faculty assessment terms endpoint or student equivalent
      const res = await axios.get<BaseResponse<AcademicTermResponseType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/assessment/terms`,
        { withCredentials: true }
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