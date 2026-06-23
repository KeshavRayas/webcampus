"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { CreateAdmissionUserSchema } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@webcampus/ui/components/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { UserPhotoUpload } from "../shared/user-photo-upload";
import {
  AdminAdmissionUserColumns,
  AdminAdmissionUserResponse,
} from "./admin-admission-users-columns";
import { useAdmissionUsers } from "./use-admission-users";

type CreateAdmissionUserFormValues = z.infer<typeof CreateAdmissionUserSchema>;

export const AdminAdmissionUsersView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { form, onSubmit, isCreating, setPhotoFile, photoFile } =
    useAdmissionUsers();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // State for password visibility and table filtering
  // const [showPassword, setShowPassword] = useState(false);
  // const [roleFilter, setRoleFilter] = useState<string>("all");

  // REMOVING UNUSED VARIABLES

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-admission-users"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<AdminAdmissionUserResponse[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/admission-users`,
        { withCredentials: true }
      );
      if (res.data.status === "success" && Array.isArray(res.data.data)) {
        return res.data.data;
      }
      return [] as AdminAdmissionUserResponse[];
    },
  });

  const replacePhotoPreview = (file: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (!file) {
      setPhotoPreview(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setPhotoPreview(nextPreviewUrl);
  };

  const resetCreateDialog = () => {
    form.reset();
    setPhotoFile(null);
    replacePhotoPreview(null);
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setPhotoFile(file);
    replacePhotoPreview(file);
  };

  const handleDialogChange = (open: boolean) => {
    setIsCreateOpen(open);

    if (!open) {
      resetCreateDialog();
    }
  };

  const handleCreateSubmit = async (values: CreateAdmissionUserFormValues) => {
    try {
      await onSubmit(values);
      setIsCreateOpen(false);
      resetCreateDialog();
    } catch {
      // Toast feedback is handled by the mutation hook.
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="bg-card text-card-foreground space-y-4 rounded-lg border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight">
            Registered Roles
          </h3>

          <Dialog open={isCreateOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button>Create User</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Create Admission User</DialogTitle>
              </DialogHeader>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleCreateSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., john.doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password *</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Minimum 6 characters"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admission_admin">
                              Admission Admin (Data Entry)
                            </SelectItem>
                            <SelectItem value="admission_reviewer">
                              Admission Reviewer (Approvals)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <UserPhotoUpload
                    label="Profile Photo"
                    personName={form.watch("name") || "Admission User"}
                    previewUrl={photoPreview}
                    selectedFileName={photoFile?.name || null}
                    onChange={handlePhotoChange}
                  />

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading users...</div>
        ) : (
          <DataTable columns={AdminAdmissionUserColumns} data={users} />
        )}
      </div>
    </div>
  );
};
