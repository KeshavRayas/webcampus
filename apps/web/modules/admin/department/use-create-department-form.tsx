"use client";

import { apiClient } from "@/lib/api-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createUserSchema, CreateUserType } from "@webcampus/schemas/admin";
import {
  CreateDepartmentDTO,
  CreateDepartmentSchema,
} from "@webcampus/schemas/department";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import type { AxiosError, AxiosResponse } from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

// import { email } from "zod";

export const useCreateDepartmentForm = () => {
  const queryClient = useQueryClient();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const form = useForm<CreateDepartmentDTO & CreateUserType>({
    resolver: zodResolver(
      CreateDepartmentSchema.extend(createUserSchema.shape)
    ),
    defaultValues: {
      name: "",
      code: "",
      abbreviation: "",
      type: "DEGREE_GRANTING", // Making sure to provide a default for type since it's now required
      email: "",
      password: "password",
      username: "", // Sent silently in the background, hidden from UI
      role: "department",
    },
  });

  const { mutate: createDepartment } = useMutation({
    mutationFn: async (data: CreateDepartmentDTO & CreateUserType) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, String(value));
        }
      });

      if (logoFile) {
        formData.append("logo", logoFile);
      }

      return await apiClient.post(`/admin/department`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["department"] });
      setLogoFile(null);
      form.reset();
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data.error);
    },
  });

  const onSubmit = async (data: CreateDepartmentDTO & CreateUserType) => {
    if (!logoFile) {
      toast.error("Department logo is required");
      return;
    }

    createDepartment(data);
  };

  return { form, onSubmit, logoFile, setLogoFile };
};
