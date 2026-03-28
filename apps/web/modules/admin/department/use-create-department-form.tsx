"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { createUserSchema, CreateUserType } from "@webcampus/schemas/admin";
import {
  CreateDepartmentDTO,
  CreateDepartmentSchema,
} from "@webcampus/schemas/department";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

export const useCreateDepartmentForm = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
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
      email: "",
      password: "password",
      username: "",
      role: "department",
    },
  });

  const { mutate: createDepartment } = useMutation({
    mutationFn: async (data: CreateDepartmentDTO & CreateUserType) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      if (logoFile) {
        formData.append("logo", logoFile);
      }

      return await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/department`,
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
      queryClient.invalidateQueries({ queryKey: ["department"] });
      setLogoFile(null);
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
