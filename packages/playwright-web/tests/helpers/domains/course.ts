import { ApiHelper } from "../api/client";
import { testDb } from "../api/db";
import { makeCourse, type MakeCourseInput } from "../factories/course";
import { appointCoordinator, assignFacultyToCourse } from "./assignment";
import { createSection } from "./section";

const PATHS = {
  create: "/department/course",
  bulkSubmit: "/department/course/bulk-submit",
  approve: "/department/course/approve",
  list: "/department/course",
};

type CourseResponse = {
  status: string;
  data?: {
    id: string;
    code: string;
    name: string;
    approvalStatus: string;
  };
};

type BulkSubmitResponse = {
  status: string;
  data?: {
    count: number;
    ids: string[];
  };
};

export async function createCourse(
  api: ApiHelper,
  courseData: Record<string, unknown>
): Promise<{ id: string; code: string }> {
  const res = await api.post<CourseResponse>(PATHS.create, courseData);
  if (res.status !== "success" || !res.data) {
    throw new Error(`Failed to create course: ${JSON.stringify(res)}`);
  }
  return { id: res.data.id, code: res.data.code };
}

export async function bulkSubmitCourses(
  api: ApiHelper,
  semesterId: string,
  cycle?: string
): Promise<string[]> {
  const body: Record<string, unknown> = { semesterId };
  if (cycle) body.cycle = cycle;
  const res = await api.post<BulkSubmitResponse>(PATHS.bulkSubmit, body);
  if (res.status !== "success" || !res.data) {
    throw new Error(`Failed to submit courses: ${JSON.stringify(res)}`);
  }
  return res.data.ids;
}

export async function approveCourse(
  api: ApiHelper,
  semesterId: string,
  options?: { departmentId?: string; cycle?: string }
): Promise<void> {
  const body: Record<string, unknown> = { semesterId };
  if (options?.departmentId) body.departmentId = options.departmentId;
  if (options?.cycle) body.cycle = options.cycle;
  const res = await api.post<{ status: string }>(PATHS.approve, body);
  if (res.status !== "success") {
    throw new Error(`Failed to approve courses: ${JSON.stringify(res)}`);
  }
}

export async function prepareCourseForSubmission(
  api: ApiHelper,
  deptId: string,
  semesterId: string,
  semesterNumber: number,
  overrides?: Partial<MakeCourseInput>
): Promise<{ id: string; code: string }> {
  const input = makeCourse({
    departmentId: deptId,
    semesterId,
    semesterNumber,
    ...overrides,
  });
  const course = await createCourse(api, input);

  const dept = await testDb.department.findUnique({ where: { id: deptId } });
  if (!dept) throw new Error(`Department ${deptId} not found`);
  const faculty = await testDb.faculty.findFirst({
    where: { departmentId: deptId },
  });
  if (!faculty) throw new Error(`No faculty in department ${deptId}`);

  await appointCoordinator(api, { courseId: course.id, facultyId: faculty.id });

  const sections = await testDb.section.findMany({
    where: { departmentId: deptId, semesterId },
    select: { id: true },
  });

  let sectionMappings: Array<{ sectionId: string; theoryFacultyId: string }>;
  if (sections.length > 0) {
    sectionMappings = sections.map((s) => ({
      sectionId: s.id,
      theoryFacultyId: faculty.id,
    }));
  } else {
    const section = await createSection(api, {
      name: `Sub ${Date.now()}`,
      departmentName: dept.name,
      semesterId,
    });
    sectionMappings = [{ sectionId: section.id, theoryFacultyId: faculty.id }];
  }

  await assignFacultyToCourse(api, {
    courseId: course.id,
    semesterId,
    academicYear: "2026",
    sectionMappings,
  });

  return course;
}

export async function createApprovedCourse(
  api: ApiHelper,
  adminApi: ApiHelper,
  deptId: string,
  semesterId: string,
  semesterNumber: number,
  overrides?: Partial<MakeCourseInput>
): Promise<{ id: string; code: string }> {
  const course = await prepareCourseForSubmission(
    api,
    deptId,
    semesterId,
    semesterNumber,
    overrides
  );
  await bulkSubmitCourses(api, semesterId);
  await approveCourse(adminApi, semesterId, { departmentId: deptId });
  return course;
}

export async function verifyCourseInDb(courseId: string) {
  return testDb.course.findUnique({
    where: { id: courseId },
    select: { id: true, code: true, approvalStatus: true, departmentId: true },
  });
}
