"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  AdmissionConstantsOptionsDTO,
  BaseResponse,
} from "@webcampus/types/api";
import axios from "axios";

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
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: ["admission-constants"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<AdmissionConstantsOptionsDTO>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/constants/options`,
        { withCredentials: true }
      );
      if (res.data.status === "success") {
        return res.data.data ?? EMPTY_OPTIONS;
      }
      return EMPTY_OPTIONS;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};
