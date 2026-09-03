"use client";

import { apiClient } from "@/lib/api-client";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BaseResponse } from "@webcampus/types/api";
import type {
  TimetableEntry,
  TimetableSlot,
  TimetableTemplate,
} from "./timetable-types";

const unwrap = (response: BaseResponse<TimetableEntry[]>) => {
  if (response.status !== "success") throw new Error(response.message);
  return response.data ?? [];
};

export const useStudentTimetable = (semesterId?: string, sectionId?: string) =>
  useQuery({
    queryKey: ["student-timetable", semesterId, sectionId],
    enabled: Boolean(semesterId) && Boolean(sectionId),
    queryFn: async () => {
      const response = (
        await apiClient.get<{
          status: string;
          data?: TimetableEntry[];
          slots?: TimetableSlot[];
          message?: string;
        }>(`/timetable/weekly/${semesterId}`, { params: { sectionId } })
      ).data;
      if (response.status !== "success") throw new Error(response.message);
      return {
        entries: response.data ?? [],
        slots: response.slots ?? [],
      };
    },
  });

export const useStudentTodayTimetable = (
  semesterId?: string,
  sectionId?: string
) =>
  useQuery({
    queryKey: ["student-timetable-today", semesterId, sectionId],
    enabled: Boolean(semesterId) && Boolean(sectionId),
    queryFn: async () =>
      unwrap(
        (
          await apiClient.get<BaseResponse<TimetableEntry[]>>(
            `/timetable/today/${semesterId}`,
            { params: { sectionId } }
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

export const useFacultyTodayTimetable = (semesterId?: string) =>
  useQuery({
    queryKey: ["faculty-timetable-today", semesterId],
    enabled: Boolean(semesterId),
    queryFn: async () =>
      unwrap(
        (
          await apiClient.get<BaseResponse<TimetableEntry[]>>(
            `/timetable/faculty/today/${semesterId}`
          )
        ).data
      ),
  });

export const useFacultyCurrentSemester = () => {
  const terms = useAcademicTerms();
  const currentTerm = terms.data?.find((term) => term.isCurrent);
  const currentSemesters = currentTerm?.Semester ?? [];
  const allSemesters = terms.data?.flatMap((term) => term.Semester ?? []) ?? [];
  return {
    terms,
    currentSemesterId: currentSemesters[0]?.id ?? allSemesters[0]?.id,
    isLoading: terms.isLoading,
  };
};

export const useDepartmentTimetable = (
  departmentId?: string,
  semesterId?: string
) =>
  useQuery({
    queryKey: ["department-timetable", departmentId, semesterId],
    enabled: Boolean(departmentId) && Boolean(semesterId),
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
    void queryClient.invalidateQueries({ queryKey: ["timetable"] });
    void queryClient.invalidateQueries({ queryKey: ["student-timetable"] });
    void queryClient.invalidateQueries({
      queryKey: ["student-timetable-today"],
    });
    void queryClient.invalidateQueries({ queryKey: ["faculty-timetable"] });
    void queryClient.invalidateQueries({
      queryKey: ["faculty-timetable-today"],
    });
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
