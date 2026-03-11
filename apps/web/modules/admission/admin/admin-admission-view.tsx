"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { SemesterResponseType } from "@webcampus/schemas/admin";
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
import { Label } from "@webcampus/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { DialogForm } from "@webcampus/ui/molecules/dialog-form";
import axios from "axios";
import React, { useState } from "react";
import {
  AdminAdmissionColumns,
  AdmissionResponse,
} from "./admin-admission-columns";
import { useCreateAdmissionShellForm } from "./use-create-admission-shell-form";

const ADMISSION_MODES = ["KCET", "COMEDK", "Management", "SNQ Quota", "Other"];

export const AdminAdmissionView = ({
  hideAddForm = false,
}: {
  hideAddForm?: boolean;
}) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");

  // 1. Fetch Semesters
  const { data: semesters } = useQuery({
    queryKey: ["semesters"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<SemesterResponseType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester`,
        { withCredentials: true }
      );
      if (res.data.status === "success") return res.data.data;
      return [];
    },
  });

  // 2. Fetch Admissions for selected semester
  const { data: admissions, isLoading } = useQuery({
    queryKey: ["admissions", selectedSemesterId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<AdmissionResponse[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/semester/${selectedSemesterId}`,
        { withCredentials: true }
      );
      if (res.data.status === "success") return res.data.data;
      return [];
    },
    enabled: !!selectedSemesterId,
  });

  const { form, onSubmit } = useCreateAdmissionShellForm(selectedSemesterId);

  return (
    <div className="space-y-8">
      <div className="w-full max-w-sm space-y-2">
        <Label>Select Admission Semester</Label>
        <Select
          value={selectedSemesterId}
          onValueChange={setSelectedSemesterId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an academic semester..." />
          </SelectTrigger>
          <SelectContent>
            {semesters?.map((sem) => (
              <SelectItem key={sem.id} value={sem.id}>
                {sem.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedSemesterId && (
        <div className="bg-card text-card-foreground space-y-4 rounded-lg border p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold tracking-tight">
              Semester Admissions
            </h3>
            {!hideAddForm && (
              <DialogForm
                trigger="Add Admission"
                title="Create Admission Profile"
                form={form}
                onSubmit={onSubmit}
              >
                <FormField
                  control={form.control}
                  name="applicationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application ID *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., APP-2026-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="modeOfAdmission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mode of Admission *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select admission mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ADMISSION_MODES.map((mode) => (
                            <SelectItem key={mode} value={mode}>
                              {mode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </DialogForm>
            )}
          </div>

          {isLoading ? (
            <div>Loading admissions...</div>
          ) : (
            <DataTable
              columns={AdminAdmissionColumns}
              data={admissions || []}
            />
          )}
        </div>
      )}
    </div>
  );
};
