"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import axios, { AxiosError } from "axios";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { z } from "zod";

type CreateFinanceUserFormValues = {
  name: string;
  email: string;
  username: string;
  password: string;
  photo?: File;
};

const createFinanceUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  photo: z.instanceof(File).optional(),
});

export const useFinanceUsers = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const form = useForm<CreateFinanceUserFormValues>({
    resolver: zodResolver(createFinanceUserSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      password: "password",
      photo: undefined,
    },
  });

  const { mutateAsync: create, isPending: isCreating } = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/finance`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-finance-users"] });
      toast.success("Finance user created successfully");
      form.reset();
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Failed to create Finance user");
    },
  });

  const onSubmit = async (data: CreateFinanceUserFormValues) => {
    try {
      const formData = new FormData();

      Object.entries(data).forEach(([key, value]) => {
        if (key !== "photo" && value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });

      if (data.photo instanceof File) {
        formData.append("photo", data.photo);
      }

      formData.append("role", "finance");

      await create(formData);
    } catch {
      toast.error("Submission interrupted due to an error.");
    }
  };

  return { form, onSubmit, isCreating };
};

export const useFinanceUserEdit = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const { mutateAsync: onEdit, isPending: isEditing } = useMutation({
    mutationFn: async ({
      id,
      formData,
    }: {
      id: string;
      formData: FormData;
    }) => {
      const response = await axios.patch(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/finance/${id}`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-finance-users"] });
      toast.success("Finance user updated successfully");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Failed to update Finance user");
    },
  });

  return { onEdit, isEditing };
};

export const useFinanceUserDelete = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const { mutateAsync: onDelete, isPending: isDeleting } = useMutation({
    mutationFn: async (id: string) => {
      const response = await axios.delete(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/finance/${id}`,
        { withCredentials: true }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-finance-users"] });
      toast.success("Finance user deleted successfully");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Failed to delete Finance user");
    },
  });

  return { onDelete, isDeleting };
};
