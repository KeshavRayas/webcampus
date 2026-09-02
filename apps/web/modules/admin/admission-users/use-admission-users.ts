"use client";

import { apiClient } from "@/lib/api-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreateAdmissionUserSchema,
  UpdateAdmissionUserSchema,
} from "@webcampus/schemas/admin";
import type { AxiosError } from "axios";
import { isAxiosError } from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { z } from "zod";

type CreateAdmissionUserFormValues = z.infer<typeof CreateAdmissionUserSchema>;
type UpdateAdmissionUserFormValues = z.infer<typeof UpdateAdmissionUserSchema>;

export const useAdmissionUsers = (
  defaultRole: "admission" | "admission-instructor" = "admission"
) => {
  const queryClient = useQueryClient();
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const form = useForm<CreateAdmissionUserFormValues>({
    resolver: zodResolver(CreateAdmissionUserSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "password",
      role: defaultRole,
      photo: undefined,
    },
  });

  const { mutateAsync: create, isPending: isCreating } = useMutation({
    mutationFn: async (data: CreateAdmissionUserFormValues) => {
      if (!photoFile) {
        throw new Error("Profile Picture is required");
      }
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("username", data.username);
      formData.append("email", data.email);
      formData.append("password", data.password);
      formData.append("role", data.role);
      formData.append("photo", photoFile);

      const response = await apiClient.post(
        `/admin/admission-users`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-admission-users"] });
      toast.success("Admission user created successfully");
      form.reset();
      setPhotoFile(null);
    },
    onError: (error: unknown) => {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to create user");
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create user");
      }
    },
  });

  const onSubmit = async (data: CreateAdmissionUserFormValues) => {
    await create(data);
  };

  return { form, onSubmit, isCreating, photoFile, setPhotoFile };
};

export const useAdmissionUserUpdate = () => {
  const queryClient = useQueryClient();
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const { mutateAsync: updateUser, isPending: isUpdating } = useMutation({
    mutationFn: async ({
      id,
      data,
      photoFile,
    }: {
      id: string;
      data: UpdateAdmissionUserFormValues;
      photoFile?: File | null;
    }) => {
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("username", data.username);
      formData.append("email", data.email);

      if (data.password) {
        formData.append("password", data.password);
      }

      if (photoFile) {
        formData.append("photo", photoFile);
      }

      const response = await apiClient.put(
        `/admin/admission-users/${id}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-admission-users"] });
      toast.success("Admission user updated successfully");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Failed to update user");
    },
  });

  return { updateUser, isUpdating, photoFile, setPhotoFile };
};

export const useAdmissionUserEdit = () => {
  const queryClient = useQueryClient();

  const { mutateAsync: onEdit, isPending: isEditing } = useMutation({
    // Changed this to accept FormData
    mutationFn: async ({
      id,
      formData,
    }: {
      id: string;
      formData: FormData;
    }) => {
      const response = await apiClient.patch(
        `/admin/admission-users/${id}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-admission-users"] });
      toast.success("User updated successfully");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Failed to update user");
    },
  });

  return { onEdit, isEditing };
};

export const useAdmissionUserDelete = () => {
  const queryClient = useQueryClient();

  const { mutateAsync: onDelete, isPending: isDeleting } = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/admin/admission-users/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-admission-users"] });
      toast.success("User deleted successfully");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Failed to delete user");
    },
  });

  return { onDelete, isDeleting };
};
