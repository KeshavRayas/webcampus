"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import type { TrustUser } from "@webcampus/schemas/trust";
import axios from "axios";

export const trustSessionQueryKey = ["trust-session"];

export const useTrustSession = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  return useQuery({
    queryKey: trustSessionQueryKey,
    queryFn: async () => {
      const response = await axios.get<{
        status: string;
        data: TrustUser;
      }>(`${NEXT_PUBLIC_API_BASE_URL}/trust/auth/me`, {
        withCredentials: true,
      });
      return response.data.data;
    },
  });
};
