"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { frontendEnv } from "@webcampus/common/env";
import axios, { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import z from "zod";

const TRUST_TOKEN_COOKIE = "trust_token";
const COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60;

const trustLoginSchema = z.object({
  identifier: z.string().trim().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

type TrustLoginFormValues = z.infer<typeof trustLoginSchema>;

function setTrustTokenCookie(token: string): void {
  document.cookie = `${TRUST_TOKEN_COOKIE}=${encodeURIComponent(
    token
  )}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export const useTrustLoginForm = () => {
  const router = useRouter();
  const form = useForm<TrustLoginFormValues>({
    resolver: zodResolver(trustLoginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = async (data: TrustLoginFormValues) => {
    try {
      const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
      const response = await axios.post<{
        status: string;
        message: string;
        data: { token: string };
      }>(`${NEXT_PUBLIC_API_BASE_URL}/trust/auth/login`, data, {
        withCredentials: true,
      });

      if (response.data.status !== "success" || !response.data.data?.token) {
        throw new Error(response.data.message || "Sign in failed");
      }

      setTrustTokenCookie(response.data.data.token);
      toast.success("Signed in successfully!");
      router.push("/trust");
      router.refresh();
    } catch (error) {
      const err = error as AxiosError<{ message?: string }>;
      toast.error(
        err.response?.data?.message || "Failed to sign in. Please try again."
      );
    }
  };

  return { form, onSubmit };
};
