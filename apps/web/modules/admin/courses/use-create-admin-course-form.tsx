"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  CreateCourseDTO,
  CreateCourseSchema,
} from "@webcampus/schemas/department";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import axios, { AxiosError, AxiosResponse } from "axios";
import { useEffect } from "react";
import { Resolver, useForm } from "react-hook-form";
import { toast } from "react-toastify";

type CourseCycle = "PHYSICS" | "CHEMISTRY" | "NONE";

export const useCreateAdminCourseForm = (
  semesterId: string,
  semesterNumber: number,
  departmentId: string,
  departmentName: string,
  defaultCycle: CourseCycle
) => {
  const queryClient = useQueryClient();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const form = useForm<CreateCourseDTO>({
    resolver: zodResolver(CreateCourseSchema) as Resolver<CreateCourseDTO>,
    defaultValues: {
      code: "",
      name: "",
      courseMode: undefined,
      courseType: undefined,
      cycle: "NONE",
      departmentId,
      departmentName,
      semesterId,
      semesterNumber,
      lectureCredits: 0,
      tutorialCredits: 0,
      practicalCredits: 0,
      skillCredits: 0,
      seeMaxMarks: 0,
      seeEligibility: 40,
      cieCount: 0,
      cieMaxMarks: 0,
      cieEligibility: 40,
      theoryMaxMarks: 0,
      theoryMinExams: 0,
      theoryEligibility: 40,
      labCount: 0,
      labMaxMarks: 0,
      labEligibility: 40,
      aatMaxMarks: 0,
      aatEligibility: 40,
      allowFeedback: false,
      attendanceRequired: true,
    },
  });

  useEffect(() => {
    form.setValue("departmentName", departmentName, { shouldValidate: true });
    form.setValue("semesterId", semesterId, { shouldValidate: true });
    form.setValue("semesterNumber", semesterNumber, { shouldValidate: true });
    form.setValue("cycle", defaultCycle, { shouldValidate: true });
  }, [defaultCycle, departmentName, form, semesterId, semesterNumber]);

  const { mutate } = useMutation({
    mutationFn: async (values: CreateCourseDTO) => {
      return axios.post(`${NEXT_PUBLIC_API_BASE_URL}/admin/course`, values, {
        withCredentials: true,
      });
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-course-mapping-status"],
      });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.error || "Failed to create course");
    },
  });

  const onSubmit = (values: CreateCourseDTO) => {
    mutate({
      ...values,
      cycle: defaultCycle,
    });
  };

  return { form, onSubmit };
};
