"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { CreateAdmissionUserSchema } from "@webcampus/schemas/admin";
import axios, { AxiosError } from "axios";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { z } from "zod";

export const useAdmissionUsers = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof CreateAdmissionUserSchema>>({
    resolver: zodResolver(CreateAdmissionUserSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
      role: "admission_reviewer",
    },
  });

  const { mutateAsync: create, isPending: isCreating } = useMutation({
    mutationFn: async (data: z.infer<typeof CreateAdmissionUserSchema>) => {
      const response = await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/admission-users`,
        data,
        { withCredentials: true }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-admission-users"] });
      toast.success("Admission user created successfully");
      form.reset();
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Failed to create user");
    },
  });

  const onSubmit = async (data: z.infer<typeof CreateAdmissionUserSchema>) => {
    await create(data);
  };

  return { form, onSubmit, isCreating };
};

export const useAdmissionUserDelete = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const { mutateAsync: onDelete, isPending: isDeleting } = useMutation({
    mutationFn: async (id: string) => {
      const response = await axios.delete(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/admission-users/${id}`,
        { withCredentials: true }
      );
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
