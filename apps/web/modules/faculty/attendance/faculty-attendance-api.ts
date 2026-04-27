import {
  apiClient,
  extractPaginatedData,
  getApiErrorMessage,
  PaginatedPayload,
} from "@/lib/api-client";
import { dayjs } from "@webcampus/common/dayjs";
import {
  BaseResponse,
  CreateOrOpenFacultyAttendanceSessionDTO,
  CreateOrOpenFacultyAttendanceSessionPayloadDTO,
  DeleteFacultyAttendanceSessionDTO,
  FacultyAttendanceDetailedReportDTO,
  FacultyAttendanceFilterOptionsDTO,
  FacultyAttendanceSessionDetailDTO,
  FacultyAttendanceSessionDTO,
  FacultyAttendanceSessionStudentsDTO,
  PaginatedResponse,
} from "@webcampus/types/api";
import { ListFacultyAttendanceSessionsFilters } from "./faculty-attendance-types";

export type CreateOrOpenSessionPayload =
  CreateOrOpenFacultyAttendanceSessionPayloadDTO;

export type SessionStudentsQuery = {
  courseId: string;
  sectionId: string;
  batchId?: string;
};

export type SessionDetailQuery = {
  sessionId: string;
};

const toPositiveInt = (value: number | undefined, fallback: number) => {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.trunc(value);
};

export const getFacultyAttendanceFilterOptions =
  async (): Promise<FacultyAttendanceFilterOptionsDTO> => {
    const response = await apiClient.get<
      BaseResponse<FacultyAttendanceFilterOptionsDTO>
    >("/faculty/attendance/session/filter-options");

    if (response.data.status !== "success" || !response.data.data) {
      throw new Error(
        response.data.message || "Failed to fetch attendance filter options"
      );
    }

    return response.data.data;
  };

export const createOrOpenFacultyAttendanceSession = async (
  payload: CreateOrOpenSessionPayload
): Promise<CreateOrOpenFacultyAttendanceSessionDTO> => {
  try {
    const response = await apiClient.post<
      BaseResponse<CreateOrOpenFacultyAttendanceSessionDTO>
    >("/faculty/attendance/session", payload);

    if (response.data.status !== "success" || !response.data.data) {
      throw new Error(response.data.message || "Failed to create/open session");
    }

    return response.data.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Failed to create/open attendance session")
    );
  }
};

export const listFacultyAttendanceSessions = async (
  filters: ListFacultyAttendanceSessionsFilters,
  signal?: AbortSignal
): Promise<PaginatedResponse<FacultyAttendanceSessionDTO>> => {
  try {
    const params: Record<string, string> = {
      page: String(toPositiveInt(filters.page, 1)),
      limit: String(toPositiveInt(filters.limit, 10)),
    };

    if (filters.courseId) {
      params.courseId = filters.courseId;
    }

    if (filters.sectionId) {
      params.sectionId = filters.sectionId;
    }

    if (filters.batchId) {
      params.batchId = filters.batchId;
    }

    if (filters.sessionDate) {
      params.sessionDate = dayjs(filters.sessionDate).format("YYYY-MM-DD");
    }

    const response = await apiClient.get<
      BaseResponse<PaginatedPayload<FacultyAttendanceSessionDTO>>
    >("/faculty/attendance/session", {
      params,
      signal,
    });

    if (response.data.status !== "success") {
      throw new Error(
        response.data.message || "Failed to fetch attendance sessions"
      );
    }

    return {
      items: extractPaginatedData(response.data.data),
      pagination: response.data.data?.pagination ?? {
        page: toPositiveInt(filters.page, 1),
        limit: toPositiveInt(filters.limit, 10),
        total: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Failed to fetch attendance sessions")
    );
  }
};

export const getFacultyAttendanceSessionStudents = async (
  query: SessionStudentsQuery
): Promise<FacultyAttendanceSessionStudentsDTO> => {
  try {
    const response = await apiClient.get<
      BaseResponse<FacultyAttendanceSessionStudentsDTO>
    >("/faculty/attendance/session/students", {
      params: {
        courseId: query.courseId,
        sectionId: query.sectionId,
        batchId: query.batchId,
      },
    });

    if (response.data.status !== "success" || !response.data.data) {
      throw new Error(
        response.data.message || "Failed to fetch session students"
      );
    }

    return response.data.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Failed to fetch session students")
    );
  }
};

export const getFacultyAttendanceSessionDetail = async (
  query: SessionDetailQuery
): Promise<FacultyAttendanceSessionDetailDTO> => {
  try {
    const response = await apiClient.get<
      BaseResponse<FacultyAttendanceSessionDetailDTO>
    >("/faculty/attendance/session/detail", {
      params: {
        sessionId: query.sessionId,
      },
    });

    if (response.data.status !== "success" || !response.data.data) {
      throw new Error(
        response.data.message || "Failed to fetch session detail"
      );
    }

    return response.data.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Failed to fetch session detail")
    );
  }
};

export const deleteFacultyAttendanceSession = async (
  sessionId: string
): Promise<DeleteFacultyAttendanceSessionDTO> => {
  try {
    const response = await apiClient.delete<
      BaseResponse<DeleteFacultyAttendanceSessionDTO>
    >(`/faculty/attendance/session/${sessionId}`);

    if (response.data.status !== "success" || !response.data.data) {
      throw new Error(
        response.data.message || "Failed to delete attendance session"
      );
    }

    return response.data.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Failed to delete attendance session")
    );
  }
};

export type DetailedReportFilters = {
  courseId: string;
  sectionId: string;
  batchId?: string;
};

export const getFacultyAttendanceDetailedReport = async (
  filters: DetailedReportFilters,
  signal?: AbortSignal
): Promise<FacultyAttendanceDetailedReportDTO> => {
  try {
    const params: Record<string, string> = {
      courseId: filters.courseId,
      sectionId: filters.sectionId,
    };

    if (filters.batchId) {
      params.batchId = filters.batchId;
    }

    const response = await apiClient.get<
      BaseResponse<FacultyAttendanceDetailedReportDTO>
    >("/faculty/attendance/report/detailed", {
      params,
      signal,
    });

    if (response.data.status !== "success" || !response.data.data) {
      throw new Error(
        response.data.message || "Failed to fetch detailed report"
      );
    }

    return response.data.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Failed to fetch detailed report")
    );
  }
};
