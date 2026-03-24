"use client";

import { authClient } from "@/lib/auth-client";
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
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

export const useCreateCourseForm = (
  semesterId: string,
  semesterNumber: number
) => {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const form = useForm<CreateCourseDTO>({
    resolver: zodResolver(CreateCourseSchema),
    defaultValues: {
      code: "",
      name: "",
      courseMode: undefined,
      courseType: undefined,
      departmentName: "",
      semesterId: semesterId,
      semesterNumber: semesterNumber,

      // Credit fields (L-T-P-S)
      lectureCredits: 0,
      tutorialCredits: 0,
      practicalCredits: 0,
      skillCredits: 0,

      // SEE Assessment
      seeMaxMarks: 0,
      seeMinMarks: 0,
      seeWeightage: 0,

      // CIE Assessment
      maxNoOfCies: 0,
      minNoOfCies: 0,
      cieMaxMarks: 0,
      cieMinMarks: 0,
      cieWeightage: 0,

      // Other Assessment
      noOfAssignments: 0,
      assignmentMaxMarks: 0,
      labMaxMarks: 0,
      labMinMarks: 0,
      labWeightage: 0,
      cumulativeMaxMarks: 0,
      cumulativeMinMarks: 0,
    },
  });

  const { isSubmitSuccessful } = form.formState;

  useEffect(() => {
    if (session?.user?.name) {
      form.setValue("departmentName", session.user.name, {
        shouldValidate: true,
      });
    }
    form.setValue("semesterId", semesterId, { shouldValidate: true });
    form.setValue("semesterNumber", semesterNumber, { shouldValidate: true });
  }, [session, form, isSubmitSuccessful, semesterId, semesterNumber]);

  const { mutate } = useMutation({
    mutationFn: async (values: CreateCourseDTO) => {
      return await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course`,
        values,
        { withCredentials: true }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(error.response?.data?.error || "Failed to create course");
    },
  });

  const onSubmit = (values: CreateCourseDTO) => {
    mutate(values);
  };

  return { form, onSubmit };
};
