"use client";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UpdateStudentProfileSchema } from "@webcampus/schemas/student";
import type { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";
import type { StudentProfilePayload } from "../../student/profile/use-student-profile";

export const adminStudentProfileKey = (studentId: string) =>
  ["admin-student-profile", studentId] as const;

export const useAdminStudentProfile = (studentId: string, enabled: boolean) =>
  useQuery({
    queryKey: adminStudentProfileKey(studentId),
    enabled,
    queryFn: async () => {
      const response = await apiClient.get<BaseResponse<StudentProfilePayload>>(
        `/admin/students/${studentId}/profile`
      );

      if (response.data.status !== "success") {
        throw new Error(response.data.message);
      }

      return response.data.data;
    },
  });

export const useUpdateAdminStudentProfile = (studentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const validated = UpdateStudentProfileSchema.parse(payload);
      const response = await apiClient.put<BaseResponse<StudentProfilePayload>>(
        `/admin/students/${studentId}/profile`,
        validated
      );

      if (response.data.status !== "success") {
        throw new Error(response.data.message);
      }

      return response.data.data;
    },
    onSuccess: () => {
      toast.success("Student profile updated");
      queryClient.invalidateQueries({
        queryKey: adminStudentProfileKey(studentId),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to update student profile")
      );
    },
  });
};
