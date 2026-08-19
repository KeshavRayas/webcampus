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
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { UserPhotoUpload } from "../shared/user-photo-upload";
import {
  AdminAdmissionUserColumns,
  AdminAdmissionUserResponse,
} from "./admin-admission-users-columns";
import { useAdmissionUsers } from "./use-admission-users";

type CreateAdmissionUserFormValues = z.infer<typeof CreateAdmissionUserSchema>;

const CreateAdmissionUserDialog = ({
  role,
}: {
  role: "admission" | "admission-instructor";
}) => {
  const { form, onSubmit, isCreating, setPhotoFile, photoFile } =
    useAdmissionUsers(role);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const title =
    role === "admission"
      ? "Create Admission User"
      : "Create Admission Instructor";

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
    } catch {}
  };

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  return (
    <Dialog open={isCreateOpen} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button>{title}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
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
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Minimum 6 characters"
                        {...field}
                        className="pr-10"
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <UserPhotoUpload
              label="Profile Photo *"
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
  );
};

export const AdminAdmissionUsersView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-admission-users", "admission"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<AdminAdmissionUserResponse[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/admission-users?role=admission`,
        { withCredentials: true }
      );
      if (res.data.status === "success" && Array.isArray(res.data.data)) {
        return res.data.data;
      }
      return [] as AdminAdmissionUserResponse[];
    },
  });

  return (
    <div className="space-y-8">
      <div className="bg-card text-card-foreground space-y-4 rounded-lg border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight">
            Admission Users
          </h3>

          <div className="flex items-center gap-2">
            <CreateAdmissionUserDialog role="admission" />
          </div>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading users...</div>
        ) : (
          <DataTable columns={AdminAdmissionUserColumns} data={users || []} />
        )}
      </div>
    </div>
  );
};
