"use client";

import { apiClient } from "@/lib/api-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { z } from "zod";

// Schema for Creating a COE User
export const CreateCoeUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  photo: z.any().optional(),
});

export const useCoeUsers = () => {
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof CreateCoeUserSchema>>({
    resolver: zodResolver(CreateCoeUserSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      password: "password", // Default password
      photo: undefined,
    },
  });

  const { mutateAsync: create, isPending: isCreating } = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiClient.post(`/admin/coe`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coes"] });
      toast.success("COE user created successfully");
      form.reset();
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Failed to create COE user");
    },
  });

  const onSubmit = async (data: z.infer<typeof CreateCoeUserSchema>) => {
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

      await create(formData);
    } catch {
      toast.error("Submission interrupted due to an error.");
    }
  };

  return { form, onSubmit, isCreating };
};

export const useCoeUserEdit = () => {
  const queryClient = useQueryClient();

  const { mutateAsync: onEdit, isPending: isEditing } = useMutation({
    mutationFn: async ({
      id,
      formData,
    }: {
      id: string;
      formData: FormData;
    }) => {
      const response = await apiClient.patch(`/admin/coe/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coes"] });
      toast.success("COE user updated successfully");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Failed to update COE user");
    },
  });

  return { onEdit, isEditing };
};

export const useCoeUserDelete = () => {
  const queryClient = useQueryClient();

  const { mutateAsync: onDelete, isPending: isDeleting } = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/admin/coe/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coes"] });
      toast.success("COE user deleted successfully");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Failed to delete COE user");
    },
  });

  return { onDelete, isDeleting };
};
