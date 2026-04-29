import { apiClient } from "@/lib/api-client";
import { BaseResponse } from "@webcampus/types/api";

export interface MarksAssessmentInfo {
  id: string;
  title: string;
  totalMarks: number;
}

export interface MarksCourseInfo {
  id: string;
  code: string;
  name: string;
  semester: {
    id: string;
    semesterNumber: number;
    academicTerm: {
      id: string;
      type: string;
      year: string;
    };
  };
  assessments: MarksAssessmentInfo[];
}

export interface MarksSectionInfo {
  id: string;
  name: string;
  semesterId: string;
}

export interface MarksDashboardAssignment {
  course: MarksCourseInfo;
  section: MarksSectionInfo | null;
}

export const getMarksDashboardAssignments = async (): Promise<
  MarksDashboardAssignment[]
> => {
  const response = await apiClient.get<
    BaseResponse<MarksDashboardAssignment[]>
  >("/faculty/marks/assessments/dashboard");

  if (response.data.status !== "success") {
    throw new Error(response.data.message || "Failed to fetch marks dashboard");
  }

  return response.data.data ?? [];
};
