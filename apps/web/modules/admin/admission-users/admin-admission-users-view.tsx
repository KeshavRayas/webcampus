"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse } from "@webcampus/types/api";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
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
import { DialogForm } from "@webcampus/ui/molecules/dialog-form";
import axios from "axios";
import React from "react";
import {
  AdminAdmissionUserColumns,
  AdminAdmissionUserResponse,
} from "./admin-admission-users-columns";
import { useAdmissionUsers } from "./use-admission-users";

export const AdminAdmissionUsersView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { form, onSubmit } = useAdmissionUsers();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-admission-users"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<AdminAdmissionUserResponse[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/admission-users`,
        { withCredentials: true }
      );
      if (res.data.status === "success" && Array.isArray(res.data.data))
        return res.data.data;
      return [] as AdminAdmissionUserResponse[];
    },
  });

  return (
    <div className="space-y-8">
      <div className="bg-card text-card-foreground space-y-4 rounded-lg border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight">
            Registered Roles
          </h3>
          <DialogForm
            trigger="Create User"
            title="Create Admission User"
            form={form}
            onSubmit={onSubmit}
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
                    <Input type="password" placeholder="Password" {...field} />
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
          </DialogForm>
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
