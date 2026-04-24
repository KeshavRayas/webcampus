"use client";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AvailableCurriculumType,
  RegistrationDashboardType,
  submitCourseRegistrationSchema,
  SubmitCourseRegistrationType,
} from "@webcampus/schemas/student";
import { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";

const registrationDashboardQueryKey = [
  "student-course-registration",
  "dashboard",
] as const;
const registrationCurriculumQueryKey = [
  "student-course-registration",
  "curriculum",
] as const;

const unwrapSuccess = <T>(response: BaseResponse<T>) => {
  if (response.status !== "success") {
    throw new Error(response.message);
  }
  return response.data;
};

export const useRegistrationDashboard = () => {
  return useQuery({
    queryKey: registrationDashboardQueryKey,
    queryFn: async () => {
      const response = await apiClient.get<
        BaseResponse<RegistrationDashboardType>
      >("/student/course-registration/dashboard");
      return unwrapSuccess(response.data);
    },
  });
};

export const useAvailableCurriculum = () => {
  return useQuery({
    queryKey: registrationCurriculumQueryKey,
    queryFn: async () => {
      const response = await apiClient.get<
        BaseResponse<AvailableCurriculumType>
      >("/student/course-registration/curriculum");
      return unwrapSuccess(response.data);
    },
  });
};

export const useSubmitCourseRegistration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SubmitCourseRegistrationType) => {
      const validated = submitCourseRegistrationSchema.parse(payload);
      const response = await apiClient.post<BaseResponse<unknown>>(
        "/student/course-registration/submit",
        validated
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Course registration submitted successfully");
      queryClient.invalidateQueries({
        queryKey: registrationDashboardQueryKey,
      });
      queryClient.invalidateQueries({
        queryKey: registrationCurriculumQueryKey,
      });
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to submit course registration")
      );
    },
  });
};

export interface EnrolledCourseItem {
  id: string;
  code: string;
  name: string;
  courseType: string;
  ltp: string;
  totalCredits: number;
}

export interface EnrolledSemesterGroup {
  semesterId: string;
  academicTermId: string;
  semesterLabel: string;
  academicTermLabel: string;
  courses: EnrolledCourseItem[];
  totalCredits: number;
}

export interface EnrolledCoursesData {
  semesters: EnrolledSemesterGroup[];
}

const enrolledCoursesQueryKey = "student-enrolled-courses" as const;

export const useEnrolledCourses = (semesterId?: string) => {
  return useQuery({
    queryKey: [enrolledCoursesQueryKey, semesterId ?? "all"],
    queryFn: async () => {
      const response = await apiClient.get<BaseResponse<EnrolledCoursesData>>(
        "/student/course-registration/enrolled",
        {
          params: semesterId ? { semesterId } : {},
        }
      );
      return unwrapSuccess(response.data);
    },
  });
};
