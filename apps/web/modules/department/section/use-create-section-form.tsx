"use client";

import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  CreateSectionSchema,
  CreateSectionType,
  GenerateCycleSectionsDTO,
  GenerateCycleSectionsSchema,
} from "@webcampus/schemas/department";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "react-toastify";

interface UseCreateSectionFormOptions {
  fixedSemesterId?: string;
  fixedDepartmentName?: string;
}

interface UnassignedDepartmentCount {
  departmentId: string;
  departmentName: string;
  abbreviation: string;
  unassignedCount: number;
}

interface UseCreateCycleSectionsFormOptions {
  termId: string;
  semesterId: string;
  semesterNumber: number;
  cycle: "PHYSICS" | "CHEMISTRY";
  academicYear: string;
}

export const useCreateSectionForm = (
  options: UseCreateSectionFormOptions = {}
) => {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const departmentName =
    options.fixedDepartmentName ?? (session?.user?.name as string);
  const semesterId = options.fixedSemesterId ?? "";

  const form = useForm({
    resolver: zodResolver(CreateSectionSchema),
    defaultValues: {
      name: "",
      departmentName,
      semesterId,
    },
  });
  const createSectionMutation = useMutation({
    mutationFn: async (data: CreateSectionType) => {
      return await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/department/section`,
        data,
        {
          withCredentials: true,
        }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data.error);
    },
  });
  const onSubmit = async (data: CreateSectionType) => {
    createSectionMutation.mutate({
      ...data,
      departmentName: options.fixedDepartmentName ?? data.departmentName,
      semesterId: options.fixedSemesterId ?? data.semesterId,
    });
  };
  return { createSectionMutation, form, onSubmit };
};

export const useCreateCycleSectionsForm = (
  options: UseCreateCycleSectionsFormOptions
) => {
  const queryClient = useQueryClient();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const form = useForm<GenerateCycleSectionsDTO>({
    resolver: zodResolver(GenerateCycleSectionsSchema),
    defaultValues: {
      termId: options.termId,
      semesterId: options.semesterId,
      semesterNumber: options.semesterNumber,
      cycle: options.cycle,
      studentsPerSection: 60,
      academicYear: options.academicYear,
      allocations: [],
    },
  });

  const allocationsFieldArray = useFieldArray({
    control: form.control,
    name: "allocations",
  });

  useEffect(() => {
    form.setValue("termId", options.termId);
    form.setValue("semesterId", options.semesterId);
    form.setValue("semesterNumber", options.semesterNumber);
    form.setValue("cycle", options.cycle);
    form.setValue("academicYear", options.academicYear);
  }, [
    form,
    options.academicYear,
    options.cycle,
    options.semesterId,
    options.semesterNumber,
    options.termId,
  ]);

  const syncAllocations = (rows: UnassignedDepartmentCount[]) => {
    allocationsFieldArray.replace(
      rows.map((row) => ({
        departmentId: row.departmentId,
        count: row.unassignedCount,
        selected: false,
      }))
    );
  };

  const generateCycleMutation = useMutation({
    mutationFn: async (data: GenerateCycleSectionsDTO) => {
      return await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/department/section/generate-cycle`,
        data,
        { withCredentials: true }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<unknown>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      queryClient.invalidateQueries({ queryKey: ["sections-with-students"] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-counts"] });
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      toast.error(
        error.response?.data?.error || "Failed to generate cycle sections"
      );
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const allocations = values.allocations.filter(
      (allocation) => allocation.selected && allocation.count > 0
    );

    generateCycleMutation.mutate({
      ...values,
      termId: options.termId,
      semesterId: options.semesterId,
      semesterNumber: options.semesterNumber,
      cycle: options.cycle,
      academicYear: options.academicYear,
      allocations,
    });
  });

  return {
    form,
    allocationsFieldArray,
    syncAllocations,
    generateCycleMutation,
    onSubmit,
  };
};
