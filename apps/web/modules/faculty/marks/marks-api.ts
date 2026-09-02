import { apiClient } from "@/lib/api-client";
import { BaseResponse } from "@webcampus/types/api";
import { isAxiosError } from "axios";

interface ExcelImportError {
  row: number;
  usn: string;
  question: string;
  message: string;
}

export interface MarksAssessmentInfo {
  id: string;
  title: string;
  totalMarks: number;
  hasMarks: boolean;
}

export interface MarksCourseInfo {
  id: string;
  code: string;
  name: string;
  courseType: string;
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
  electiveBatchId: string | null;
  electiveBatchName: string | null;
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

export const downloadMarksTemplate = async (
  assessmentId: string,
  sectionId: string | undefined,
  electiveBatchId: string | undefined,
  courseCode: string,
  assessmentTitle: string
): Promise<void> => {
  const params: Record<string, string> = {};
  if (sectionId) params.sectionId = sectionId;
  if (electiveBatchId) params.electiveBatchId = electiveBatchId;

  const response = await apiClient.get(
    `/faculty/marks/assessments/${assessmentId}/marks/template`,
    { params, responseType: "blob" }
  );

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `${courseCode}_${assessmentTitle.replace(
      /[^a-z0-9]+/gi,
      "_"
    )}_marks_template.xlsx`
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const uploadMarksExcel = async (
  assessmentId: string,
  sectionId: string | undefined,
  electiveBatchId: string | undefined,
  file: File
): Promise<void> => {
  const formData = new FormData();
  formData.append("file", file);
  if (sectionId) formData.append("sectionId", sectionId);
  if (electiveBatchId) formData.append("electiveBatchId", electiveBatchId);

  try {
    const response = await apiClient.post<BaseResponse<null>>(
      `/faculty/marks/assessments/${assessmentId}/marks/excel/upload`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );

    if (response.data.status !== "success") {
      throw new Error(response.data.message || "Failed to upload marks");
    }
  } catch (error) {
    const errors = (
      isAxiosError(error)
        ? (error.response?.data as { data?: { errors?: ExcelImportError[] } })
            ?.data?.errors
        : undefined
    ) as ExcelImportError[] | undefined;

    if (errors && errors.length > 0) {
      throw new Error(
        `Marks upload rejected (${errors.length} error(s)):\n` +
          errors
            .map(
              (entry) =>
                `Row ${entry.row} (USN ${entry.usn})` +
                (entry.question !== "-" ? ` - ${entry.question}` : "") +
                `: ${entry.message}`
            )
            .join("\n")
      );
    }

    throw error;
  }
};
