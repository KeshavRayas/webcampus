"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import type { AcademicTermResponseType } from "@webcampus/schemas/admin";
import type { BaseResponse } from "@webcampus/types/api";
import axios from "axios";

/**
 * Faculty-safe hook for fetching academic terms.
 * Hits GET /faculty/assessment/terms (faculty-protected) instead of /admin/semester.
 */
export const useFacultyAcademicTerms = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["faculty-academic-terms"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<AcademicTermResponseType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/assessment/terms`,
        { withCredentials: true }
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
