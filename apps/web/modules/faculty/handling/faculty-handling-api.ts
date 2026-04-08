import {
  apiClient,
  extractPaginatedData,
  PaginatedPayload,
} from "@/lib/api-client";
import { BaseResponse } from "@webcampus/types/api";
import {
  FacultyHandlingAssignmentDTO,
  FacultyHandlingFilterOptionsDTO,
  FacultyHandlingStudentDTO,
  PaginatedResponse,
} from "@webcampus/types/api";
import {
  FacultyHandlingFilters,
  FacultyHandlingKind,
} from "./faculty-handling-types";

const toPositiveInt = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toApiParams = (filters: FacultyHandlingFilters) => {
  const params: Record<string, string> = {};

  if (filters.search) {
    params.search = filters.search;
  }
  if (filters.academicTerm) {
    params.academicTermId = filters.academicTerm;
  }
  if (filters.programType) {
    params.programType = filters.programType;
  }
  if (filters.semester) {
    params.semesterId = filters.semester;
  }
  if (filters.section) {
    params.section = filters.section;
  }

  params.page = String(toPositiveInt(filters.page, 1));
  params.limit = String(toPositiveInt(filters.limit ?? "10", 10));

  return params;
};

export const getFacultyHandlingAssignments = async (
  kind: FacultyHandlingKind,
  filters: FacultyHandlingFilters
): Promise<PaginatedResponse<FacultyHandlingAssignmentDTO>> => {
  const params = toApiParams(filters);

  const response = await apiClient.get<
    BaseResponse<PaginatedPayload<FacultyHandlingAssignmentDTO>>
  >(`/faculty/handling/${kind}`, {
    params,
  });

  if (response.data.status !== "success") {
    throw new Error(response.data.message || "Failed to fetch handling data");
  }

  return {
    items: extractPaginatedData(response.data.data),
    pagination: response.data.data?.pagination ?? {
      page: toPositiveInt(params.page ?? "1", 1),
      limit: toPositiveInt(params.limit ?? "10", 10),
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
};

export const getFacultyHandlingStudents = async (
  kind: FacultyHandlingKind,
  assignmentId: string,
  filters: FacultyHandlingFilters
): Promise<PaginatedResponse<FacultyHandlingStudentDTO>> => {
  const response = await apiClient.get<
    BaseResponse<PaginatedPayload<FacultyHandlingStudentDTO>>
  >(`/faculty/handling/${kind}/${assignmentId}/students`, {
    params: toApiParams(filters),
  });

  if (response.data.status !== "success") {
    throw new Error(response.data.message || "Failed to fetch students");
  }

  return {
    items: extractPaginatedData(response.data.data),
    pagination: response.data.data?.pagination ?? {
      page: toPositiveInt(filters.page, 1),
      limit: toPositiveInt(filters.limit ?? "10", 10),
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
};

export const getFacultyHandlingFilterOptions = async (
  kind: FacultyHandlingKind
): Promise<FacultyHandlingFilterOptionsDTO> => {
  const response = await apiClient.get<BaseResponse<FacultyHandlingFilterOptionsDTO>>(
    `/faculty/handling/${kind}/filter-options`
  );

  if (response.data.status !== "success" || !response.data.data) {
    throw new Error(response.data.message || "Failed to fetch filter options");
  }

  return response.data.data;
};
