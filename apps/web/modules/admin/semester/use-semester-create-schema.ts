"use client";

import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  CreateSemesterSchema,
  CreateSemesterType,
  SemesterResponseType,
} from "@webcampus/schemas/admin";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

export const useSemesterCreateSchema = (semesters?: SemesterResponseType[]) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear().toString();
  const form = useForm<CreateSemesterType>({
    resolver: zodResolver(CreateSemesterSchema),
    defaultValues: {
      type: "odd",
      year: currentYear,
      semesterNumber: 1,
      startDate: new Date(),
      endDate: new Date(),
      userId: session?.user?.id || "",
    },
  });

  useEffect(() => {
    if (session?.user?.id) {
      form.setValue("userId", session.user.id);
    }
  }, [session, form]);

  const { mutate: createSemester } = useMutation({
    mutationFn: async (data: CreateSemesterType) => {
      return await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester`,
        data,
        {
          withCredentials: true,
        }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
      form.reset({
        type: "odd",
        year: currentYear,
        semesterNumber: 1,
        startDate: new Date(),
        endDate: new Date(),
        userId: session?.user?.id || "",
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to create semester"
      );
    },
  });

  const onSubmit = (data: CreateSemesterType) => {
    if (semesters) {
      const hasOverlap = semesters.some((semester) => {
        const startA = new Date(data.startDate).getTime();
        const endA = new Date(data.endDate).getTime();
        const startB = new Date(semester.startDate).getTime();
        const endB = new Date(semester.endDate).getTime();

        return startA <= endB && endA >= startB;
      });

      if (hasOverlap) {
        toast.error("Semester dates overlap with an existing semester.");
        return;
      }
    }
    createSemester(data);
  };

  return { form, onSubmit };
};
