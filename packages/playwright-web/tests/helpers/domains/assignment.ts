import { ApiHelper } from "../api/client";
import { testDb } from "../api/db";

const PATHS = {
  courseAssignment: "/department/course-assignment",
  coordinator: (courseId: string) =>
    `/department/course/${courseId}/coordinators`,
};

type UpsertResponse = {
  status: string;
  data?: {
    created: number;
  };
};

type CoordinatorResponse = {
  status: string;
  data?: Record<string, unknown>;
};

export async function assignFacultyToCourse(
  api: ApiHelper,
  data: {
    courseId: string;
    semesterId: string;
    academicYear: string;
    sectionMappings: Array<{
      sectionId: string;
      theoryFacultyId?: string | null;
    }>;
  }
): Promise<void> {
  const res = await api.post<UpsertResponse>(
    `${PATHS.courseAssignment}/upsert`,
    data as unknown as Record<string, unknown>
  );
  if (res.status !== "success") {
    throw new Error(`Failed to assign faculty: ${JSON.stringify(res)}`);
  }
}

export async function appointCoordinator(
  api: ApiHelper,
  data: {
    courseId: string;
    facultyId: string;
  }
): Promise<void> {
  const res = await api.put<CoordinatorResponse>(
    PATHS.coordinator(data.courseId),
    { facultyIds: [data.facultyId] }
  );
  if (res.status !== "success") {
    throw new Error(`Failed to appoint coordinator: ${JSON.stringify(res)}`);
  }
}

export async function verifyAssignmentInDb(assignmentId: string) {
  return testDb.courseAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      courseId: true,
      facultyId: true,
      sectionId: true,
      assignmentType: true,
    },
  });
}
