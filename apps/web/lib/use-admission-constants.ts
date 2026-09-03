"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import {
  AdmissionConstantsOptionsDTO,
  BaseResponse,
} from "@webcampus/types/api";

const EMPTY_OPTIONS: AdmissionConstantsOptionsDTO = {
  modes: [],
  categoriesClaimed: {},
  categoriesAllotted: {},
  quotas: {},
};

/**
 * Fetches admission constants (modes, quotas, categories claimed/allotted)
 * from the backend. These drive the admission dropdowns throughout the app.
 */
export const useAdmissionConstants = () => {
  return useQuery({
    queryKey: ["admission-constants"],
    queryFn: async () => {
      const res = await apiClient.get<
        BaseResponse<AdmissionConstantsOptionsDTO>
      >(`/admission/constants/options`);
      if (res.data.status === "success") {
        return res.data.data ?? EMPTY_OPTIONS;
      }
      throw new Error(res.data.message || "Failed to load admission constants");
    },
    staleTime: 5 * 60 * 1000,
  });
};
