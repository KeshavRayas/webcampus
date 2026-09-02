"use client";

import { apiClient } from "@/lib/api-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createUserSchema,
  type CreateUserType,
} from "@webcampus/schemas/admin";
import { roles, type Role } from "@webcampus/types/rbac";
import { useForm } from "react-hook-form";

interface UseCreateUserFormProps {
  role: Role;
}

export const useCreateUserForm = ({ role }: UseCreateUserFormProps) => {
  const queryClient = useQueryClient();
  const form = useForm<CreateUserType>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      name: "",
      password: "password",
      role,
      username: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: CreateUserType) => apiClient.post(`/admin/user`, data),
    onSuccess: () => {
      roles.forEach((role) => {
        queryClient.invalidateQueries({ queryKey: [role] });
      });
      form.reset();
    },
  });

  const onSubmit = (data: CreateUserType) => {
    mutation.mutate(data);
  };

  return {
    form,
    onSubmit,
  };
};
