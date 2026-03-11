"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  CreateAdmissionShellSchema,
  CreateAdmissionShellType,
} from "@webcampus/schemas/admission";
import { ErrorResponse } from "@webcampus/types/api";
import axios, { AxiosError } from "axios";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

export const useCreateAdmissionShellForm = (semesterId: string) => {
  const queryClient = useQueryClient();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const form = useForm<CreateAdmissionShellType>({
    resolver: zodResolver(CreateAdmissionShellSchema),
    defaultValues: {
      applicationId: "",
      modeOfAdmission: "KCET", // Default value
      semesterId: semesterId,
    },
  });

  const { isSubmitSuccessful } = form.formState;

  // Keep the semesterId locked into the hidden field
  useEffect(() => {
    form.setValue("semesterId", semesterId, { shouldValidate: true });
    if (isSubmitSuccessful) {
      form.reset({ applicationId: "", modeOfAdmission: "KCET", semesterId });
    }
  }, [semesterId, form, isSubmitSuccessful]);

  const { mutate } = useMutation({
    mutationFn: async (values: CreateAdmissionShellType) => {
      return await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/shell`,
        values,
        { withCredentials: true }
      );
    },
    onSuccess: () => {
      toast.success("Admission shell created! Applicant can now log in.");
      queryClient.invalidateQueries({ queryKey: ["admissions", semesterId] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to create admission shell"
      );
    },
  });

  const onSubmit = (values: CreateAdmissionShellType) => {
    mutate(values);
  };

  return { form, onSubmit };
};
