"use client";

import { apiClient } from "@/lib/api-client";
import { frontendEnv } from "@webcampus/common/env";
import type { FeedbackReportQuery } from "@webcampus/schemas/feedback";

const baseUrl = () => frontendEnv().NEXT_PUBLIC_API_BASE_URL;

export async function getFeedbackReport(
  query: FeedbackReportQuery,
  role: string
) {
  const response = await apiClient.get(`${baseUrl()}/${role}/feedback/report`, {
    params: query,
  });
  return response.data.data;
}

export async function getFeedbackFilterOptions(
  role: string,
  scope?: { academicTermId?: string; semesterId?: string; courseId?: string }
) {
  const response = await apiClient.get(
    `${baseUrl()}/${role}/feedback/filter-options`,
    { params: scope }
  );
  return response.data.data as {
    faculty: Array<{ id: string; shortName: string; user: { name: string } }>;
    courses: Array<{ id: string; code: string; name: string }>;
    sections: Array<{
      id: string;
      name: string;
      isElectiveBatch?: boolean;
    }>;
    batches: Array<{ id: string; name: string }>;
    departments: Array<{ id: string; name: string }>;
    rounds: Array<{ id: string; roundNumber: number; name: string }>;
  };
}

export async function getRoundFaculties(
  roundId: string,
  departmentId?: string
) {
  const response = await apiClient.get(
    `${baseUrl()}/admin/feedback/rounds/${roundId}/faculties`,
    {
      params: departmentId ? { departmentId } : undefined,
    }
  );
  return response.data.data;
}

export type CourseDistributionResult = {
  metadata: {
    academicYear: string;
    semester: string;
    program: string;
    branch: string;
    courseCode: string;
    courseName: string;
    section: string;
    facultyName: string;
    totalStudents: number;
  };
  questions: Array<{
    questionNumber: number;
    questionText: string;
    excellent: number;
    veryGood: number;
    good: number;
    fair: number;
    poor: number;
    rowTotal: number;
  }>;
  totals: {
    excellent: number;
    veryGood: number;
    good: number;
    fair: number;
    poor: number;
    overallAverage: number;
  };
};

export async function getCourseDistribution(
  roundId: string,
  facultyId: string,
  courseId: string,
  sectionId?: string
) {
  const response = await apiClient.get(
    `${baseUrl()}/admin/feedback/rounds/${roundId}/course-distribution`,
    {
      params: { facultyId, courseId, ...(sectionId ? { sectionId } : {}) },
    }
  );
  return response.data.data as CourseDistributionResult;
}

export async function getRoundFacultyCourses(
  roundId: string,
  facultyId: string
) {
  const response = await apiClient.get(
    `${baseUrl()}/admin/feedback/rounds/${roundId}/faculties/${facultyId}/courses`
  );
  return response.data.data;
}

export async function getRoundCourseSections(
  roundId: string,
  facultyId: string,
  courseId: string
) {
  const response = await apiClient.get(
    `${baseUrl()}/admin/feedback/rounds/${roundId}/faculties/${facultyId}/courses/${courseId}/sections`
  );
  return response.data.data;
}

export async function getRoundSectionStudents(
  roundId: string,
  facultyId: string,
  courseId: string,
  sectionId: string
) {
  const response = await apiClient.get(
    `${baseUrl()}/admin/feedback/rounds/${roundId}/faculties/${facultyId}/courses/${courseId}/sections/${sectionId}/students`
  );
  return response.data.data;
}

export function downloadFeedbackCsv(
  rows: Array<Record<string, unknown>>,
  filename = "feedback-report.csv"
) {
  if (!rows.length) return;
  const firstRow = rows[0];
  if (!firstRow) return;
  const headers = Object.keys(firstRow);
  const escape = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header])),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadFeedbackCsvRows(
  headers: string[],
  rows: Array<Array<string | number>>,
  filename = "feedback-report.csv"
) {
  const escape = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
