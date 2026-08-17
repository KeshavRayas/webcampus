"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BaseResponse } from "@webcampus/types/api";
import type { TimetableEntry, TimetableTemplate } from "./timetable-types";

const unwrap = (response: BaseResponse<TimetableEntry[]>) => {
  if (response.status !== "success") throw new Error(response.message);
  return response.data ?? [];
};

export const useStudentTimetable = (semesterId?: string) =>
  useQuery({
    queryKey: ["student-timetable", semesterId],
    enabled: Boolean(semesterId),
    queryFn: async () =>
      unwrap(
        (
          await apiClient.get<BaseResponse<TimetableEntry[]>>(
            `/timetable/weekly/${semesterId}`
          )
        ).data
      ),
  });

export const useFacultyTimetable = (semesterId?: string) =>
  useQuery({
    queryKey: ["faculty-timetable", semesterId],
    enabled: Boolean(semesterId),
    queryFn: async () =>
      unwrap(
        (
          await apiClient.get<BaseResponse<TimetableEntry[]>>(
            `/timetable/faculty/weekly/${semesterId}`
          )
        ).data
      ),
  });

export const useDepartmentTimetable = (
  departmentId?: string,
  semesterId?: string
) =>
  useQuery({
    queryKey: ["department-timetable", departmentId, semesterId],
    enabled: Boolean(departmentId),
    queryFn: async () =>
      unwrap(
        (
          await apiClient.get<BaseResponse<TimetableEntry[]>>(
            `/timetable/department/${departmentId}`,
            { params: { semesterId } }
          )
        ).data
      ),
  });

export const useTimetableTemplate = (semesterId?: string) =>
  useQuery({
    queryKey: ["timetable-template", semesterId],
    enabled: Boolean(semesterId),
    queryFn: async () => {
      const response = (
        await apiClient.get<BaseResponse<TimetableTemplate>>(
          `/timetable/template/${semesterId}`
        )
      ).data;
      if (response.status !== "success") throw new Error(response.message);
      return response.data;
    },
  });

export type TimetableMutationInput = {
  academicYear: string;
  semesterId: string;
  courseId: string;
  facultyId: string;
  roomNumber: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  classType: string;
  sectionId?: string;
  batchId?: string;
};

export const useTimetableMutations = () => {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["department-timetable"] });
    void queryClient.invalidateQueries({ queryKey: ["timetable-template"] });
  };
  const create = useMutation({
    mutationFn: (input: TimetableMutationInput) =>
      apiClient.post("/timetable", input),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<TimetableMutationInput>;
    }) => apiClient.put(`/timetable/${id}`, input),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/timetable/${id}`),
    onSuccess: refresh,
  });
  const setStatus = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    }) => apiClient.patch(`/timetable/${id}/status`, { status }),
    onSuccess: refresh,
  });
  return { create, update, remove, setStatus };
};
