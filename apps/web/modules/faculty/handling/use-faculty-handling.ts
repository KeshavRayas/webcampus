"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getFacultyHandlingAssignments,
  getFacultyHandlingFilterOptions,
  getFacultyHandlingStudents,
} from "./faculty-handling-api";
import {
  FacultyHandlingFilters,
  FacultyHandlingKind,
} from "./faculty-handling-types";

export const useFacultyHandlingAssignments = (
  kind: FacultyHandlingKind,
  filters: FacultyHandlingFilters
) => {
  return useQuery({
    queryKey: ["faculty-handling", kind, filters],
    queryFn: () => getFacultyHandlingAssignments(kind, filters),
  });
};

export const useFacultyHandlingStudents = (
  kind: FacultyHandlingKind,
  assignmentId: string | null,
  filters: FacultyHandlingFilters
) => {
  return useQuery({
    queryKey: ["faculty-handling-students", kind, assignmentId, filters],
    queryFn: () =>
      getFacultyHandlingStudents(kind, assignmentId as string, filters),
    enabled: Boolean(assignmentId),
  });
};

export const useFacultyHandlingFilterOptions = (kind: FacultyHandlingKind) => {
  return useQuery({
    queryKey: ["faculty-handling-filter-options", kind],
    queryFn: () => getFacultyHandlingFilterOptions(kind),
  });
};
