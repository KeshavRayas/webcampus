"use client";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCourseRegistrationSchema } from "@webcampus/schemas/student";
import { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";
import { z } from "zod";

export type EligibleCoursePayload = {
  courseId: string;
  code: string;
  name: string;
  totalCredits: number;
  semester: number;
  academicYear: string;
  courseType: string;
  courseMode: string;
  isRegistered: boolean;
};

const eligibleCoursesQueryKey = ["student-course-registration", "eligible"] as const;

const createCourseRegistrationRequestSchema = createCourseRegistrationSchema.pick({
  courseId: true,
  semester: true,
  academicYear: true,
});

const unwrapSuccess = <T>(response: BaseResponse<T>) => {
  if (response.status !== "success") {
    throw new Error(response.message);
  }
  return response.data;
};

export const useEligibleCourseRegistration = () => {
  return useQuery({
    queryKey: eligibleCoursesQueryKey,
    queryFn: async () => {
      const response = await apiClient.get<BaseResponse<EligibleCoursePayload[]>>(
        "/student/course-registration/eligible"
      );
      return unwrapSuccess(response.data) ?? [];
    },
  });
};

export const useRegisterCourse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: z.input<typeof createCourseRegistrationRequestSchema>
    ) => {
      const validated = createCourseRegistrationRequestSchema.parse(payload);
      const response = await apiClient.post<BaseResponse<unknown>>(
        "/student/course-registration",
        validated
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Course registered successfully");
      queryClient.invalidateQueries({ queryKey: eligibleCoursesQueryKey });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to register course"));
    },
  });
};
