"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { UpdateDepartmentSchema } from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import axios, { AxiosError, AxiosResponse } from "axios";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { z } from "zod";
import { DepartmentTableItem } from "./admin-department-columns";

interface EditDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: DepartmentTableItem;
}

export const EditDepartmentDialog = ({
  open,
  onOpenChange,
  department,
}: EditDepartmentDialogProps) => {
  const queryClient = useQueryClient();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const form = useForm<z.infer<typeof UpdateDepartmentSchema>>({
    resolver: zodResolver(UpdateDepartmentSchema),
    defaultValues: {
      name: department.name,
      code: department.code,
      abbreviation: department.abbreviation,
      type: department.type || "DEGREE_GRANTING",
      username: department.username || "",
      displayUsername: department.displayUsername || department.name,
    },
  });

  // Sync default values when dialog opens with fresh department data
  useEffect(() => {
    if (open) {
      form.reset({
        name: department.name,
        code: department.code,
        abbreviation: department.abbreviation,
        type: department.type || "DEGREE_GRANTING",
        username: department.username || "",
        displayUsername: department.displayUsername || department.name,
      });
      setLogoFile(null);
    }
  }, [open, department, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof UpdateDepartmentSchema>) => {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });

      if (logoFile) {
        formData.append("logo", logoFile);
      }

      return await axios.patch<BaseResponse<unknown>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/department/${department.id}`,
        formData,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
    },
    onSuccess: (data: AxiosResponse<BaseResponse<unknown>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["department"] });
      onOpenChange(false);
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Failed to edit department");
    },
  });

  const handleSubmit = (values: z.infer<typeof UpdateDepartmentSchema>) => {
    updateMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Edit Department</DialogTitle>
            </DialogHeader>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="text"
                      placeholder="Department Name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input {...field} type="text" placeholder="e.g. CS" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="abbreviation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abbreviation</FormLabel>
                  <FormControl>
                    <Input {...field} type="text" placeholder="e.g. CSE" />
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
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} type="text" placeholder="department.username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="displayUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Username</FormLabel>
                  <FormControl>
                    <Input {...field} type="text" placeholder="Display name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DEGREE_GRANTING">
                        Degree Granting
                      </SelectItem>
                      <SelectItem value="BASIC_SCIENCES">
                        Basic Sciences
                      </SelectItem>
                      <SelectItem value="SERVICE">Service</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Update Department Logo</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setLogoFile(file);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button disabled={updateMutation.isPending} type="submit">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
