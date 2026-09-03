"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import type { BaseResponse } from "@webcampus/types/api";

export interface StudentComponentResult {
  active: boolean;
  obtained: number;
  maxForEligibility: number;
  pct: number | null;
  eligible: boolean;
}

export interface StudentCourseMarks {
  courseId: string;
  courseCode: string;
  courseName: string;
  assessments: Array<{
    id: string;
    title: string;
    componentType: "THEORY" | "LAB" | "AAT";
    maxMarks: number;
    totalMarks: number | null;
    status: string | null;
  }>;
  components: {
    theory: StudentComponentResult;
    lab: StudentComponentResult;
    aat: StudentComponentResult;
  } | null;
  total: number | null;
  status: string;
}

export const useStudentMarks = (semesterId: string) => {
  return useQuery({
    queryKey: ["student-marks-summary", semesterId],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<StudentCourseMarks[]>>(
        `/student/marks/summary`,
        {
          params: { semesterId },
        }
      );

      if (res.data.status === "success" && "data" in res.data) {
        return res.data.data;
      }

      return [];
    },
    enabled: !!semesterId,
  });
};
