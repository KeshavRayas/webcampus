import { apiClient } from "@/lib/api-client";
import { BaseResponse } from "@webcampus/types/api";
import {
  MarksReportData,
  MarksReportFilterOptionsData,
} from "./marks-report-types";

export const getMarksReportFilterOptions =
  async (): Promise<MarksReportFilterOptionsData> => {
    const response = await apiClient.get<
      BaseResponse<MarksReportFilterOptionsData>
    >("/faculty/marks/report/filter-options");

    if (response.data.status !== "success" || !response.data.data) {
      throw new Error(
        response.data.message || "Failed to fetch filter options"
      );
    }

    return response.data.data;
  };

export const getMarksReport = async (
  courseId: string,
  sectionId?: string
): Promise<MarksReportData> => {
  const params: Record<string, string> = { courseId };
  if (sectionId) {
    params.sectionId = sectionId;
  }

  const response = await apiClient.get<BaseResponse<MarksReportData>>(
    "/faculty/marks/report",
    { params }
  );

  if (response.data.status !== "success" || !response.data.data) {
    throw new Error(response.data.message || "Failed to fetch marks report");
  }

  return response.data.data;
};
