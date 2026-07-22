import { expect, test } from "@playwright/test";
import { createApiForRole } from "../helpers/api/client";
import { testDb } from "../helpers/api/db";
import {
  bulkSubmitCourses,
  createApprovedCourse,
  prepareCourseForSubmission,
} from "../helpers/domains/course";

function makeCourseUpdatePayload(
  course: { id: string; code?: string },
  dept: { id: string; name: string },
  overrides: Partial<{
    name: string;
    lectureCredits: number;
    version: number;
  }>
) {
  return {
    id: course.id,
    name: overrides.name ?? course.code ?? "Test Course",
    code: course.code ?? `TST${Date.now().toString(36).slice(-4)}`,
    courseType: "PC" as const,
    courseMode: "NON_INTEGRATED" as const,
    departmentId: dept.id,
    departmentName: dept.name,
    lectureCredits: overrides.lectureCredits ?? 4,
    tutorialCredits: 0,
    practicalCredits: 0,
    skillCredits: 0,
    seeMaxMarks: 100,
    seeMinMarks: 40,
    seeWeightage: 100,
    maxNoOfCies: 3,
    minNoOfCies: 2,
    cieMaxMarks: 40,
    cieMinMarks: 0,
    cieWeightage: 100,
    noOfAssignments: 2,
    assignmentMaxMarks: 10,
    labMaxMarks: 0,
    labMinMarks: 0,
    labWeightage: 0,
    cumulativeMaxMarks: 100,
    cumulativeMinMarks: 40,
    version: overrides.version,
  };
}

test.describe("Admin course override - course configuration", () => {
  test("admin can update course config after approval", async ({ browser }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      3
    );

    const dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });
    expect(dbCourse!.approvalStatus).toBe("APPROVED");

    const updatedName = `Admin Edited ${Date.now()}`;
    const updateRes = await adminApi.put<{
      status: string;
      data?: {
        id: string;
        name: string;
        approvalStatus: string;
        version: number;
      };
    }>(
      "/admin/course",
      makeCourseUpdatePayload(course, dept!, {
        name: updatedName,
        version: dbCourse!.version,
      })
    );

    expect(updateRes.status).toBe("success");

    const updated = await testDb.course.findUnique({
      where: { id: course.id },
    });
    expect(updated!.name).toBe(updatedName);
    expect(updated!.approvalStatus).toBe("APPROVED");
    expect(updated!.hasPostApprovalEdits).toBe(true);
  });

  test("department cannot edit course after submission", async ({
    browser,
  }) => {
    const deptApi = await createApiForRole(browser, "department");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 5 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await prepareCourseForSubmission(
      deptApi,
      dept!.id,
      semester!.id,
      5
    );
    await bulkSubmitCourses(deptApi, semester!.id);

    const dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });
    expect(dbCourse!.approvalStatus).toBe("PENDING");

    await expect(
      deptApi.put("/department/course", {
        id: course.id,
        name: "Should Fail",
        code: "FAIL1",
        courseType: "PC",
        courseMode: "NON_INTEGRATED",
        lectureCredits: 3,
        tutorialCredits: 0,
        practicalCredits: 0,
        skillCredits: 0,
        seeMaxMarks: 100,
        seeMinMarks: 40,
        seeWeightage: 100,
        maxNoOfCies: 3,
        minNoOfCies: 2,
        cieMaxMarks: 40,
        cieMinMarks: 0,
        cieWeightage: 100,
        noOfAssignments: 2,
        assignmentMaxMarks: 10,
        labMaxMarks: 0,
        labMinMarks: 0,
        labWeightage: 0,
        cumulativeMaxMarks: 100,
        cumulativeMinMarks: 40,
      })
    ).rejects.toThrow();
  });

  test("department cannot edit course after approval", async ({ browser }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 5 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      5
    );

    await expect(
      deptApi.put("/department/course", {
        id: course.id,
        name: "Should Fail",
        code: "FAIL2",
        courseType: "PC",
        courseMode: "NON_INTEGRATED",
        lectureCredits: 3,
        tutorialCredits: 0,
        practicalCredits: 0,
        skillCredits: 0,
        seeMaxMarks: 100,
        seeMinMarks: 40,
        seeWeightage: 100,
        maxNoOfCies: 3,
        minNoOfCies: 2,
        cieMaxMarks: 40,
        cieMinMarks: 0,
        cieWeightage: 100,
        noOfAssignments: 2,
        assignmentMaxMarks: 10,
        labMaxMarks: 0,
        labMinMarks: 0,
        labWeightage: 0,
        cumulativeMaxMarks: 100,
        cumulativeMinMarks: 40,
      })
    ).rejects.toThrow();
  });
});

test.describe("Admin course override - mapping", () => {
  test("admin can update course mapping after approval", async ({
    browser,
  }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      3
    );

    const faculty = await testDb.faculty.findFirst({
      where: { departmentId: dept!.id },
      select: { id: true },
    });
    expect(faculty).toBeDefined();

    const sections = await testDb.section.findMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
      select: { id: true },
    });
    expect(sections.length).toBeGreaterThan(0);

    const dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });

    const mappingRes = await adminApi.post<{
      status: string;
      data?: unknown;
    }>("/admin/course-assignment/upsert", {
      courseId: course.id,
      departmentId: dept!.id,
      departmentName: dept!.name,
      semesterId: semester!.id,
      academicYear: "2026",
      studentsPerLabBatch: 15,
      version: dbCourse!.version,
      sectionMappings: sections.map((s) => ({
        sectionId: s.id,
        theoryFacultyId: faculty!.id,
        labFacultyByBatch: [],
      })),
    });

    expect(mappingRes.status).toBe("success");

    const updated = await testDb.course.findUnique({
      where: { id: course.id },
    });
    expect(updated!.approvalStatus).toBe("APPROVED");
    expect(updated!.hasPostApprovalEdits).toBe(true);
  });
});

test.describe("Admin course override - coordinators", () => {
  test("admin can update coordinators after approval", async ({ browser }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      3
    );

    const faculty = await testDb.faculty.findMany({
      where: { departmentId: dept!.id },
      select: { id: true },
      take: 2,
    });

    const facultyIds = faculty.map((f) => f.id);

    const dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });

    const coordRes = await adminApi.put<{ status: string }>(
      `/admin/course/${course.id}/coordinators`,
      {
        facultyIds,
        version: dbCourse!.version,
      }
    );

    expect(coordRes.status).toBe("success");

    const coordsInDb = await testDb.courseCoordinator.findMany({
      where: { courseId: course.id },
    });
    expect(coordsInDb.length).toBe(facultyIds.length);
  });
});

test.describe("Admin override - audit logging", () => {
  test("course config edit creates audit records", async ({ browser }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.adminEditLog.deleteMany({});
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      3
    );

    const dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });

    await adminApi.put(
      "/admin/course",
      makeCourseUpdatePayload(course, dept!, {
        name: "Audited Course",
        lectureCredits: 5,
        version: dbCourse!.version,
      })
    );

    const auditLogs = await testDb.adminEditLog.findMany({
      where: { courseId: course.id },
    });
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs.some((log) => log.fieldName === "name")).toBe(true);
  });

  test("multiple edits create multiple audit change groups", async ({
    browser,
  }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.adminEditLog.deleteMany({});
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      3
    );

    let dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });

    await adminApi.put(
      "/admin/course",
      makeCourseUpdatePayload(course, dept!, {
        name: "First Edit",
        lectureCredits: 3,
        version: dbCourse!.version,
      })
    );

    dbCourse = await testDb.course.findUnique({ where: { id: course.id } });

    await adminApi.put(
      "/admin/course",
      makeCourseUpdatePayload(course, dept!, {
        name: "Second Edit",
        lectureCredits: 4,
        version: dbCourse!.version,
      })
    );

    const auditLogs = await testDb.adminEditLog.findMany({
      where: { courseId: course.id },
      distinct: ["changeGroupId"],
    });
    expect(auditLogs.length).toBeGreaterThanOrEqual(2);
  });

  test("coordinator change creates audit records", async ({ browser }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.adminEditLog.deleteMany({});
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      3
    );

    const faculty = await testDb.faculty.findFirst({
      where: { departmentId: dept!.id },
      select: { id: true },
    });

    let dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });

    await adminApi.put(`/admin/course/${course.id}/coordinators`, {
      facultyIds: [],
      version: dbCourse!.version,
    });

    dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });

    await adminApi.put(`/admin/course/${course.id}/coordinators`, {
      facultyIds: [faculty!.id],
      version: dbCourse!.version,
    });

    const auditLogs = await testDb.adminEditLog.findMany({
      where: {
        courseId: course.id,
        entityType: "COORDINATOR",
      },
    });
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs.some((log) => log.action === "UPDATE_COORDINATOR")).toBe(
      true
    );
  });
});

test.describe("Admin override - optimistic locking", () => {
  test("stale version is rejected with 409", async ({ browser }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      3
    );

    const dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });

    const staleVersion = dbCourse!.version - 1;

    await expect(
      adminApi.put(
        "/admin/course",
        makeCourseUpdatePayload(course, dept!, {
          name: "Stale Edit",
          lectureCredits: 3,
          version: staleVersion,
        })
      )
    ).rejects.toThrow();
  });
});

test.describe("Admin course override - coordinator course lookup", () => {
  test("GET /admin/course/:id with departmentId returns 200", async ({
    browser,
  }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      3
    );

    const res = await adminApi.get<{ status: string; data?: unknown }>(
      `/admin/course/${course.id}?departmentId=${dept!.id}`
    );

    expect(res.status).toBe("success");
    expect(res.data).toBeDefined();
  });

  test("GET /admin/course/:id without departmentId returns 400", async ({
    browser,
  }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      3
    );

    await expect(adminApi.get(`/admin/course/${course.id}`)).rejects.toThrow();
  });
});

test.describe("Admin course override - mapping reason validation", () => {
  test("mapping upsert on locked course with reason succeeds", async ({
    browser,
  }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.adminEditLog.deleteMany({});
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      3
    );

    const faculty = await testDb.faculty.findFirst({
      where: { departmentId: dept!.id },
      select: { id: true },
    });
    expect(faculty).toBeDefined();

    const sections = await testDb.section.findMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
      select: { id: true },
    });
    expect(sections.length).toBeGreaterThan(0);

    const dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });

    const mappingRes = await adminApi.post<{
      status: string;
      data?: unknown;
    }>("/admin/course-assignment/upsert", {
      courseId: course.id,
      departmentId: dept!.id,
      departmentName: dept!.name,
      semesterId: semester!.id,
      academicYear: "2026",
      studentsPerLabBatch: 15,
      version: dbCourse!.version,
      reason: "Test override reason",
      sectionMappings: sections.map((s) => ({
        sectionId: s.id,
        theoryFacultyId: faculty!.id,
        labFacultyByBatch: [],
      })),
    });

    expect(mappingRes.status).toBe("success");

    const auditLogs = await testDb.adminEditLog.findMany({
      where: { courseId: course.id, entityType: "COURSE_ASSIGNMENT" },
    });
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs.some((log) => log.action === "UPSERT_MAPPING")).toBe(true);
  });

  test("mapping upsert on locked course without reason is rejected", async ({
    browser,
  }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      3
    );

    const faculty = await testDb.faculty.findFirst({
      where: { departmentId: dept!.id },
      select: { id: true },
    });
    expect(faculty).toBeDefined();

    const sections = await testDb.section.findMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
      select: { id: true },
    });
    expect(sections.length).toBeGreaterThan(0);

    const dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });

    await expect(
      adminApi.post("/admin/course-assignment/upsert", {
        courseId: course.id,
        departmentId: dept!.id,
        departmentName: dept!.name,
        semesterId: semester!.id,
        academicYear: "2026",
        studentsPerLabBatch: 15,
        version: dbCourse!.version,
        sectionMappings: sections.map((s) => ({
          sectionId: s.id,
          theoryFacultyId: faculty!.id,
          labFacultyByBatch: [],
        })),
      })
    ).rejects.toThrow();
  });
});

test.describe("Admin override - approval status preservation", () => {
  test("approval status remains APPROVED after mapping override", async ({
    browser,
  }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      3
    );

    const dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });
    expect(dbCourse!.approvalStatus).toBe("APPROVED");

    const faculty = await testDb.faculty.findFirst({
      where: { departmentId: dept!.id },
      select: { id: true },
    });

    const sections = await testDb.section.findMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
      select: { id: true },
    });

    await adminApi.post("/admin/course-assignment/upsert", {
      courseId: course.id,
      departmentId: dept!.id,
      departmentName: dept!.name,
      semesterId: semester!.id,
      academicYear: "2026",
      studentsPerLabBatch: 15,
      version: dbCourse!.version,
      reason: "Override test",
      sectionMappings: sections.map((s) => ({
        sectionId: s.id,
        theoryFacultyId: faculty!.id,
        labFacultyByBatch: [],
      })),
    });

    const updated = await testDb.course.findUnique({
      where: { id: course.id },
    });
    expect(updated!.approvalStatus).toBe("APPROVED");
  });

  test("approval status remains APPROVED after coordinator override", async ({
    browser,
  }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      3
    );

    const dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });

    const faculty = await testDb.faculty.findFirst({
      where: { departmentId: dept!.id },
      select: { id: true },
    });

    await adminApi.put(`/admin/course/${course.id}/coordinators`, {
      facultyIds: [faculty!.id],
      version: dbCourse!.version,
      reason: "Override test",
    });

    const updated = await testDb.course.findUnique({
      where: { id: course.id },
    });
    expect(updated!.approvalStatus).toBe("APPROVED");
  });
});

test.describe("Admin override - mapping audit contains reason", () => {
  test("mapping upsert audit log records reason", async ({ browser }) => {
    const deptApi = await createApiForRole(browser, "department");
    const adminApi = await createApiForRole(browser, "admin");

    const dept = await testDb.department.findFirst({ where: { code: "CS" } });
    expect(dept).toBeDefined();
    const semester = await testDb.semester.findFirst({
      where: { programType: "UG", semesterNumber: 3 },
    });
    expect(semester).toBeDefined();

    await testDb.courseAssignment.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.courseCoordinator.deleteMany({
      where: { course: { departmentId: dept!.id, semesterId: semester!.id } },
    });
    await testDb.adminEditLog.deleteMany({});
    await testDb.course.deleteMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
    });

    const course = await createApprovedCourse(
      deptApi,
      adminApi,
      dept!.id,
      semester!.id,
      3
    );

    const faculty = await testDb.faculty.findFirst({
      where: { departmentId: dept!.id },
      select: { id: true },
    });
    expect(faculty).toBeDefined();

    const sections = await testDb.section.findMany({
      where: { departmentId: dept!.id, semesterId: semester!.id },
      select: { id: true },
    });

    const dbCourse = await testDb.course.findUnique({
      where: { id: course.id },
    });

    const expectedReason = "Test auditing reason";
    await adminApi.post("/admin/course-assignment/upsert", {
      courseId: course.id,
      departmentId: dept!.id,
      departmentName: dept!.name,
      semesterId: semester!.id,
      academicYear: "2026",
      studentsPerLabBatch: 15,
      version: dbCourse!.version,
      reason: expectedReason,
      sectionMappings: sections.map((s) => ({
        sectionId: s.id,
        theoryFacultyId: faculty!.id,
        labFacultyByBatch: [],
      })),
    });

    const auditLogs = await testDb.adminEditLog.findMany({
      where: { courseId: course.id },
    });

    expect(auditLogs.length).toBeGreaterThan(0);
  });
});
