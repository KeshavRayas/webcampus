"use client";

import { apiClient } from "@/lib/api-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreateProgrammeOutcomeSchema,
  CreateProgrammeOutcomeType,
} from "@webcampus/schemas/admin";
import { SuccessResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Switch } from "@webcampus/ui/components/switch";
import type { AxiosError } from "axios";
import { Loader2 } from "lucide-react";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { ProgrammeOutcomeTableItem } from "./types";

interface ProgrammeOutcomeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  outcome?: ProgrammeOutcomeTableItem;
  defaultProgramType?: "UG" | "PG";
  defaultDepartmentId?: string;
  defaultType?: "PO" | "PEO" | "PSO";
}

export const ProgrammeOutcomeDialog = ({
  isOpen,
  onOpenChange,
  outcome,
  defaultProgramType = "UG",
  defaultDepartmentId = "",
  defaultType = "PO",
}: ProgrammeOutcomeDialogProps) => {
  const queryClient = useQueryClient();
  const isEditing = !!outcome;

  const departmentsQuery = useQuery({
    queryKey: ["department"],
    queryFn: async () => {
      return await apiClient.get<
        SuccessResponse<{ id: string; name: string }[]>
      >(`/admin/department`);
    },
  });

  const form = useForm({
    resolver: zodResolver(CreateProgrammeOutcomeSchema),
    defaultValues: {
      programType: "UG",
      departmentId: "",
      type: "PO",
      code: "",
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (outcome) {
        form.reset({
          programType: outcome.programType as "UG" | "PG",
          departmentId: outcome.departmentId || "",
          type: outcome.type as "PEO" | "PSO" | "PO",
          code: outcome.code,
          description: outcome.description,
          isActive: outcome.isActive,
        });
      } else {
        form.reset({
          programType: defaultProgramType,
          departmentId: defaultDepartmentId,
          type: defaultType,
          code: "",
          description: "",
          isActive: true,
        });
      }
    } else {
      form.reset();
    }
  }, [
    outcome,
    isOpen,
    form,
    defaultProgramType,
    defaultDepartmentId,
    defaultType,
  ]);

  const mutation = useMutation({
    mutationFn: async (values: CreateProgrammeOutcomeType) => {
      if (isEditing) {
        return await apiClient.put(
          `/admin/programme-outcomes/${outcome.id}`,
          values
        );
      }
      return await apiClient.post(`/admin/programme-outcomes`, values);
    },
    onSuccess: () => {
      toast.success(
        `Outcome ${isEditing ? "updated" : "created"} successfully`
      );
      queryClient.invalidateQueries({ queryKey: ["programme-outcomes"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const err = error as AxiosError<{ message?: string }>;
      toast.error(err.response?.data?.message || "Failed to save outcome");
    },
  });

  const onSubmit = (values: CreateProgrammeOutcomeType) => {
    mutation.mutate(values);
  };

  const departments = departmentsQuery.data?.data?.data || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit" : "Create"} Programme Outcome
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="programType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select program type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="UG">UG</SelectItem>
                      <SelectItem value="PG">PG</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department (Optional)</FormLabel>
                  <Select
                    onValueChange={(val) =>
                      field.onChange(val === "none" ? "" : val)
                    }
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">
                        None (Common for Program Type)
                      </SelectItem>
                      {departments.map((dept: { id: string; name: string }) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Leave as None if this outcome applies to all departments in
                    the Program Type (e.g. common UG POs).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outcome Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PEO">PEO</SelectItem>
                        <SelectItem value="PSO">PSO</SelectItem>
                        <SelectItem value="PO">PO</SelectItem>
                      </SelectContent>
                    </Select>
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
                      <Input placeholder="e.g. PO1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Description of the outcome"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <FormDescription>
                      Is this outcome currently active?
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? "Save Changes" : "Create Outcome"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
