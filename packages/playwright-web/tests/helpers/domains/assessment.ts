import { ApiHelper } from "../api/client";
import { testDb } from "../api/db";

const PATHS = {
  assessment: "/faculty/assessment",
  coordinatedCourses: "/faculty/assessment/coordinated-courses",
};

type AssessmentResponse = {
  status: string;
  data?: {
    id: string;
    title: string;
    totalMarks: number;
    courseId: string;
  };
};

export async function createAssessmentTemplate(
  api: ApiHelper,
  data: {
    courseId: string;
    semesterId: string;
    title: string;
    totalMarks: number;
    questions?: Array<{
      part: "A" | "B" | "C";
      qNumber: number;
      marks: number;
      co: number;
      po: number;
      bl: number;
      orGroupId?: number;
    }>;
  }
): Promise<{ id: string; title: string }> {
  const res = await api.post<AssessmentResponse>(
    PATHS.assessment,
    data as unknown as Record<string, unknown>
  );
  if (res.status !== "success" || !res.data) {
    throw new Error(
      `Failed to create assessment template: ${JSON.stringify(res)}`
    );
  }
  return { id: res.data.id, title: res.data.title };
}

export async function verifyAssessmentInDb(assessmentId: string) {
  return testDb.assessmentTemplate.findUnique({
    where: { id: assessmentId },
    include: { questions: true },
  });
}
