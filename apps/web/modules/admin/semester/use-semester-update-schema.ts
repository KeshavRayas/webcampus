"use client";

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

export const useSemesterUpdateSchema = (
  semester: SemesterResponseType,
  onSuccessCallback?: () => void
) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const form = useForm<CreateSemesterType>({
    resolver: zodResolver(CreateSemesterSchema),
    defaultValues: {
      type: semester.type,
      year: semester.year,
      startDate: new Date(semester.startDate),
      endDate: new Date(semester.endDate),
      userId: semester.userId || "",
    },
  });

  // Update form values when semester prop changes
  useEffect(() => {
    form.reset({
      type: semester.type,
      year: semester.year,
      startDate: new Date(semester.startDate),
      endDate: new Date(semester.endDate),
      userId: semester.userId || "",
    });
  }, [semester, form]);

  const { mutate: updateSemester } = useMutation({
    mutationFn: async (data: CreateSemesterType) => {
      return await axios.put(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester/${semester.id}`,
        data,
        {
          withCredentials: true,
        }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
      onSuccessCallback?.();
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      const errorMessage =
        error.response?.data?.error || error.message || "An error occurred";
      toast.error(errorMessage);
    },
  });

  const onUpdate = (data: CreateSemesterType) => {
    updateSemester(data);
  };

  return { form, onUpdate };
};
