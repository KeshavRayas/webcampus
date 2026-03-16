import { frontendEnv } from "@webcampus/common/env";
import axios, { AxiosError } from "axios";

export type NormalizedApiError = {
  message: string;
  status: number;
  code?: string;
  details?: unknown;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
};

export type PaginatedPayload<T> = {
  data: T[];
  pagination: PaginationMeta;
};

export const apiClient = axios.create({
  baseURL: frontendEnv().NEXT_PUBLIC_API_BASE_URL,
  withCredentials: true,
});

const normalizeApiError = (error: unknown): NormalizedApiError => {
  if (axios.isAxiosError(error)) {
    return {
      message:
        (error.response?.data as { message?: string } | undefined)?.message ||
        error.message ||
        "Request failed",
      status: error.response?.status ?? 500,
      code: error.code,
      details: error.response?.data,
    };
  }

  return {
    message: error instanceof Error ? error.message : "Unknown error",
    status: 500,
  };
};

apiClient.interceptors.request.use(
  (config) => {
    config.headers = config.headers ?? {};
    return config;
  },
  (error) => Promise.reject(normalizeApiError(error))
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      (error as AxiosError & { normalized?: NormalizedApiError }).normalized =
        normalizeApiError(error);
      return Promise.reject(error);
    }

    return Promise.reject(normalizeApiError(error));
  }
);

export const getApiErrorMessage = (
  error: unknown,
  fallback = "Something went wrong"
): string => {
  if (axios.isAxiosError(error)) {
    const normalized = (
      error as AxiosError & { normalized?: NormalizedApiError }
    ).normalized;
    if (normalized?.message) {
      return normalized.message;
    }

    const responseMessage = (error.response?.data as { message?: string })
      ?.message;
    if (responseMessage) {
      return responseMessage;
    }

    return error.message || fallback;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
};

export const extractPaginatedData = <T>(
  payload: T[] | PaginatedPayload<T> | null | undefined
): T[] => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.data;
};
