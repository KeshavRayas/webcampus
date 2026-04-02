"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { createUserSchema } from "@webcampus/schemas/admin";
import { CreateFacultySchema } from "@webcampus/schemas/faculty";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { useEffect, useState } from "react";
import { Resolver, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { z } from "zod";

// Combine both schemas for the complete payload
const FormSchema = CreateFacultySchema.extend(createUserSchema.shape);
type FormType = z.infer<typeof FormSchema>;

export const useCreateAdminFacultyForm = (departmentId: string) => {
  const queryClient = useQueryClient();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [imageFile, setImageFile] = useState<File | null>(null);

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema) as Resolver<FormType>,
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "password", // Default password
      role: "faculty", // Force the role
      departmentId: departmentId,
      designation: "ASSISTANT_PROFESSOR",
      employeeId: "",
      staffType: "REGULAR",
      dob: new Date(),
      dateOfJoining: new Date(),
    },
  });

  const { isSubmitSuccessful } = form.formState;

  // Silently keep the departmentId accurate, even after successful submits and resets
  useEffect(() => {
    form.setValue("departmentId", departmentId, { shouldValidate: true });
  }, [departmentId, form, isSubmitSuccessful]);

  const { mutate } = useMutation({
    mutationFn: async (values: FormType) => {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      if (imageFile) {
        formData.append("image", imageFile);
      }

      return await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/faculty`,
        formData,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({
        queryKey: ["admin-faculty", departmentId],
      });
      setImageFile(null);
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.error || "Failed to create faculty");
    },
  });

  const onSubmit = (values: FormType) => {
    if (!imageFile) {
      toast.error("Faculty image is required");
      return;
    }

    mutate(values);
  };

  return { form, onSubmit, imageFile, setImageFile };
};
