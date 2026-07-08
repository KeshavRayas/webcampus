import { ApiHelper } from "../api/client";
import { testDb } from "../api/db";

const PATHS = {
  section: "/department/section",
  sectionAssignment: "/department/section-assignment",
  sectionAssignmentsBySection: (sectionId: string) =>
    `/department/section-assignment/section/${sectionId}`,
};

type SectionResponse = {
  status: string;
  data?: {
    id: string;
    name: string;
  };
};

type SectionAssignmentResponse = {
  status: string;
  data?: {
    id: string;
    studentId: string;
    sectionId: string;
    semester: number;
    academicYear: string;
  };
};

type SectionAssignmentsListResponse = {
  status: string;
  data?: Array<{
    id: string;
    studentId: string;
    sectionId: string;
    semester: number;
    academicYear: string;
  }>;
};

export async function createSection(
  api: ApiHelper,
  data: Record<string, unknown>
): Promise<{ id: string; name: string }> {
  const res = await api.post<SectionResponse>(PATHS.section, data);
  if (res.status !== "success" || !res.data) {
    throw new Error(`Failed to create section: ${JSON.stringify(res)}`);
  }
  return { id: res.data.id, name: res.data.name };
}

export async function assignStudentToSection(
  api: ApiHelper,
  data: {
    studentId: string;
    sectionId: string;
    semester: number;
    academicYear: string;
  }
): Promise<{ id: string }> {
  const res = await api.post<SectionAssignmentResponse>(
    PATHS.sectionAssignment,
    data as unknown as Record<string, unknown>
  );
  if (res.status !== "success" || !res.data) {
    throw new Error(
      `Failed to assign student to section: ${JSON.stringify(res)}`
    );
  }
  return { id: res.data.id };
}

export async function getSectionAssignments(
  api: ApiHelper,
  sectionId: string
): Promise<Array<{ id: string; studentId: string }>> {
  const res = await api.get<SectionAssignmentsListResponse>(
    PATHS.sectionAssignmentsBySection(sectionId)
  );
  if (res.status !== "success" || !res.data) {
    throw new Error(
      `Failed to get section assignments: ${JSON.stringify(res)}`
    );
  }
  return res.data;
}

export async function verifySectionInDb(sectionId: string) {
  return testDb.section.findUnique({
    where: { id: sectionId },
    include: { batches: true },
  });
}

export async function verifyStudentSectionsInDb(sectionId: string) {
  return testDb.studentSection.findMany({
    where: { sectionId },
    include: { student: true },
  });
}
