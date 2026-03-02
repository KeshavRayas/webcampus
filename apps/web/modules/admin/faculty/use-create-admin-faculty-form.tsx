"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { createUserSchema } from "@webcampus/schemas/admin";
import { CreateFacultySchema } from "@webcampus/schemas/faculty";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { z } from "zod";

// Combine both schemas for the complete payload
const FormSchema = CreateFacultySchema.extend(createUserSchema.shape);
type FormType = z.infer<typeof FormSchema>;

export const useCreateAdminFacultyForm = (departmentId: string) => {
  const queryClient = useQueryClient();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "password", // Default password
      role: "faculty", // Force the role
      departmentId: departmentId,
      designation: "ASSISTANT_PROFESSOR",
    },
  });

  const { isSubmitSuccessful } = form.formState;

  // Silently keep the departmentId accurate, even after successful submits and resets
  useEffect(() => {
    form.setValue("departmentId", departmentId, { shouldValidate: true });
  }, [departmentId, form, isSubmitSuccessful]);

  const { mutate } = useMutation({
    mutationFn: async (values: FormType) => {
      return await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/faculty`,
        values,
        { withCredentials: true }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-faculty", departmentId],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.error || "Failed to create faculty");
    },
  });

  const onSubmit = (values: FormType) => {
    mutate(values);
  };

  return { form, onSubmit };
};
