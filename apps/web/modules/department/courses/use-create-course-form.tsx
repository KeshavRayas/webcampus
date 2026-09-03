"use client";

import { apiClient } from "@/lib/api-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreateCourseDTO,
  CreateCourseSchema,
} from "@webcampus/schemas/department";
import { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import type { AxiosError, AxiosResponse } from "axios";
import { useEffect } from "react";
import { Resolver, useForm } from "react-hook-form";
import { toast } from "react-toastify";

export const useCreateCourseForm = (
  semesterId: string,
  semesterNumber: number,
  defaultCycle: "PHYSICS" | "CHEMISTRY" | "NONE"
) => {
  const queryClient = useQueryClient();
  const form = useForm<CreateCourseDTO>({
    resolver: zodResolver(CreateCourseSchema) as Resolver<CreateCourseDTO>,
    defaultValues: {
      code: "",
      name: "",
      courseMode: undefined,
      courseType: undefined,
      cycle: "NONE",
      departmentName: "AUTH_SCOPED",
      semesterId: semesterId,
      semesterNumber: semesterNumber,

      lectureCredits: 0,
      tutorialCredits: 0,
      practicalCredits: 0,
      skillCredits: 0,

      // Defaulting all Eligibility to 40% as per requirements
      seeMaxMarks: 0,
      seeEligibility: 40,
      cieMaxMarks: 0,
      cieEligibility: 40,
      theoryMaxExams: 0,
      theoryExamMaxMarks: 0,
      theoryMinExams: 0,
      theoryCieContribution: 0,
      theoryEligibility: 40,
      labMaxMarks: 0,
      labEligibility: 40,
      aatMaxMarks: 0,
      aatEligibility: 40,
      allowFeedback: true,
      attendanceRequired: true,
      numberOfBatches: undefined,
      studentsPerBatch: undefined,
      openElectiveEligibility: "ALL",
      eligibleDepartmentIds: [],
    },
  });

  const { isSubmitSuccessful } = form.formState;

  useEffect(() => {
    form.setValue("semesterId", semesterId, { shouldValidate: true });
    form.setValue("semesterNumber", semesterNumber, { shouldValidate: true });
    form.setValue("cycle", defaultCycle, { shouldValidate: true });
  }, [form, isSubmitSuccessful, semesterId, semesterNumber, defaultCycle]);

  const { mutate } = useMutation({
    mutationFn: async (values: CreateCourseDTO) => {
      return await apiClient.post(`/department/course`, values);
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["pe-capacity-summary"] });
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
