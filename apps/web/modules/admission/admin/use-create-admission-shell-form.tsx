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

type CreateAdmissionShellPayload = CreateAdmissionShellType & {
  semesterId: string;
};

export const useCreateAdmissionShellForm = (semesterId: string) => {
  const queryClient = useQueryClient();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const form = useForm<CreateAdmissionShellType>({
    resolver: zodResolver(CreateAdmissionShellSchema),
    defaultValues: {
      primaryEmail: "",
      password: "",
      semesterId,
    },
  });

  useEffect(() => {
    form.reset({
      primaryEmail: form.getValues("primaryEmail"),
      password: form.getValues("password"),
      semesterId,
    });
  }, [semesterId]);

  const { isSubmitSuccessful } = form.formState;

  useEffect(() => {
    if (isSubmitSuccessful) {
      form.reset({
        primaryEmail: "",
        password: "",
      });
    }
  }, [form, isSubmitSuccessful]);

  const { mutate } = useMutation({
    mutationFn: async (values: CreateAdmissionShellPayload) => {
      return await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/shell`,
        values,
        { withCredentials: true }
      );
    },
    onSuccess: () => {
      toast.success("Admission shell created! Applicant can now log in.");
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
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
