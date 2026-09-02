"use client";

import { apiClient } from "@/lib/api-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { z } from "zod";
import { AccountsUser } from "./accounts-types";

export const accountsUsersQueryKey = ["admin-accounts-users"];

type CreateAccountsUserFormValues = {
  name: string;
  email: string;
  username: string;
  password: string;
  photo?: File;
};

const createAccountsUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  photo: z.instanceof(File).optional(),
});

export const useAccountsUsersQuery = () => {
  return useQuery({
    queryKey: accountsUsersQueryKey,
    queryFn: async () => {
      const response = await apiClient.get<{
        status: string;
        data: AccountsUser[];
      }>(`/admin/accounts`);
      return response.data.data;
    },
  });
};

export const useAccountsUsers = () => {
  const queryClient = useQueryClient();

  const form = useForm<CreateAccountsUserFormValues>({
    resolver: zodResolver(createAccountsUserSchema),
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
      const response = await apiClient.post(`/admin/accounts`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsUsersQueryKey });
      toast.success("Accounts user created successfully");
      form.reset();
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(
        error.response?.data?.message || "Failed to create Accounts user"
      );
    },
  });

  const onSubmit = async (data: CreateAccountsUserFormValues) => {
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

      formData.append("role", "accounts");

      await create(formData);
    } catch {
      toast.error("Submission interrupted due to an error.");
    }
  };

  return { form, onSubmit, isCreating };
};

export const useAccountsUserEdit = () => {
  const queryClient = useQueryClient();

  const { mutateAsync: onEdit, isPending: isEditing } = useMutation({
    mutationFn: async ({
      id,
      formData,
    }: {
      id: string;
      formData: FormData;
    }) => {
      const response = await apiClient.patch(
        `/admin/accounts/${id}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsUsersQueryKey });
      toast.success("Accounts user updated successfully");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(
        error.response?.data?.message || "Failed to update Accounts user"
      );
    },
  });

  return { onEdit, isEditing };
};

export const useAccountsUserDelete = () => {
  const queryClient = useQueryClient();

  const { mutateAsync: onDelete, isPending: isDeleting } = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/admin/accounts/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsUsersQueryKey });
      toast.success("Accounts user deleted successfully");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(
        error.response?.data?.message || "Failed to delete Accounts user"
      );
    },
  });

  return { onDelete, isDeleting };
};
