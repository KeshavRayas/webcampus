import "dotenv/config";
import { auth } from "@webcampus/auth";
import { db } from "@webcampus/db";

const API_BASE = "http://localhost:8080";

const CS_DEPT_ID = "8034d5db-7886-4833-ae2f-4902c13ec939";
const SEMESTER_ID = "fc91ad5c-fe83-4b59-8d63-4f4dc9de653d";
const ACADEMIC_TERM_ID = "4f4bd7d9-27d1-48b1-b091-b12893206a09";
const ACADEMIC_YEAR = "2026";

const CS_FACULTY_ID = "1de8c326-b781-4474-8066-5045136ff0e5";
const FY_FACULTY_ID = "1ee7cc4b-f677-4283-91c2-a0011e513a2a";

const STUDENTS = [
  { usn: "TBM26CS0001", email: "cassandra.cs26@bmsce.ac.in", section: "PA" },
  { usn: "TBM26CS0002", email: "jayson.cs26@bmsce.ac.in", section: "PA" },
  { usn: "TBM26CS0003", email: "jed.cs26@bmsce.ac.in", section: "PA" },
  { usn: "TBM26CS0004", email: "kristina.cs26@bmsce.ac.in", section: "PB" },
  { usn: "TBM26CS0005", email: "marques.cs26@bmsce.ac.in", section: "PB" },
  { usn: "TBM26CS0006", email: "roxane.cs26@bmsce.ac.in", section: "PB" },
];

const PASSWORD = "password";

type MappingStudent = {
  studentId: string;
  usn: string;
  name: string;
  sectionId: string | null;
  sectionName: string | null;
  electiveBatchId: string | null;
  locked: boolean;
};

type MappingBatch = {
  id: string;
  name: string;
  sortOrder: number;
  facultyId: string | null;
  facultyName: string | null;
};

type MappingDetail = {
  courseId: string;
  code: string;
  name: string;
  studentsPerBatch: number | null;
  numberOfBatches: number | null;
  electiveMappingVersion: number;
  hasAttendanceOrMarks: boolean;
  batches: MappingBatch[];
  students: MappingStudent[];
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`✗ ${message}`);
  }
}

async function api(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  token: string | undefined,
  body?: Record<string, unknown>
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
}

class PeTestRun {
  private tokens: Record<string, string | undefined> = {};
  private courseId = "";
  private createdCourseCodes: string[] = [];
  private createdWindowIds: string[] = [];
  private courseCode = "";

  private async signInAs(
    label: string,
    email: string,
    password: string
  ): Promise<string> {
    const response = await auth.api.signInEmail({ body: { email, password } });
    assert(response.token, `${label} sign-in failed (no token)`);
    this.tokens[label] = response.token as string;
    return this.tokens[label];
  }

  private async step(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
      console.log(`✓ ${name}`);
    } catch (error) {
      console.log(`✗ ${name}`);
      throw error;
    }
  }

  async run(): Promise<void> {
    // ---- Auth ----
    await this.step("Sign in admin", async () => {
      await this.signInAs("admin", "dev@webcampus.com", PASSWORD);
    });
    await this.step("Sign in dept.cs", async () => {
      await this.signInAs("dept", "dept.cs@webcampus.com", PASSWORD);
    });
    await this.step("Sign in faculty.fy", async () => {
      await this.signInAs("facultyFy", "faculty.fy@webcampus.com", PASSWORD);
    });
    await this.step("Sign in faculty.cs", async () => {
      await this.signInAs("facultyCs", "faculty.cs@webcampus.com", PASSWORD);
    });
    for (const student of STUDENTS) {
      await this.step(`Sign in ${student.usn}`, async () => {
        await this.signInAs(student.usn, student.email, PASSWORD);
      });
    }

    // ---- Create PE course ----
    this.courseCode = `PE-E2E-${Date.now()}`;
    await this.step(
      `Create PE course ${this.courseCode} (3 batches x 3 = cap 9)`,
      async () => {
        const { status, json } = await api(
          "POST",
          "/department/course",
          this.tokens.dept,
          {
            code: this.courseCode,
            name: "E2E Program Elective",
            courseType: "PE",
            courseMode: "NON_INTEGRATED",
            departmentId: CS_DEPT_ID,
            semesterId: SEMESTER_ID,
            semesterNumber: 1,
            lectureCredits: 3,
            tutorialCredits: 0,
            practicalCredits: 0,
            skillCredits: 0,
            seeMaxMarks: 100,
            seeEligibility: 40,
            cieMaxMarks: 40,
            cieEligibility: 40,
            theoryMaxExams: 3,
            theoryMinExams: 2,
            theoryExamMaxMarks: 20,
            theoryCieContribution: 30,
            theoryEligibility: 40,
            labMaxMarks: 0,
            labEligibility: 0,
            aatMaxMarks: 10,
            aatEligibility: 40,
            numberOfBatches: 3,
            studentsPerBatch: 3,
          }
        );
        assert(
          status >= 200 && status < 300,
          `course create failed (${status}) ${JSON.stringify(json)}`
        );
        const data = json as { data?: { id?: string } };
        this.courseId = data?.data?.id ?? "";
        this.createdCourseCodes.push(this.courseCode);
        assert(this.courseId, "course create returned no id");
      }
    );

    // ---- Assert 3 ElectiveBatch rows ----
    await this.step("Assert 3 ElectiveBatch rows exist", async () => {
      const batches = await db.electiveBatch.findMany({
        where: { courseId: this.courseId },
      });
      assert(
        batches.length === 3,
        `expected 3 elective batches, got ${batches.length}`
      );
    });

    // ---- Appoint coordinator ----
    await this.step("Appoint coordinator (CS001)", async () => {
      const { status, json } = await api(
        "PUT",
        `/department/course/${this.courseId}/coordinators`,
        this.tokens.dept,
        { facultyIds: [CS_FACULTY_ID] }
      );
      assert(
        status >= 200 && status < 300,
        `coordinators failed (${status}) ${JSON.stringify(json)}`
      );
    });

    // ---- Faculty mapping (batch1->FY001, batch2->CS001, batch3->CS001) ----
    await this.step(
      "Map faculty to elective batches (FY->b1, CS->b2,b3)",
      async () => {
        const batches = await db.electiveBatch.findMany({
          where: { courseId: this.courseId },
          orderBy: { sortOrder: "asc" },
        });
        assert(batches.length === 3, "cannot map: expected 3 batches");
        const electiveBatchMappings = [
          { electiveBatchId: batches[0]!.id, facultyId: FY_FACULTY_ID },
          { electiveBatchId: batches[1]!.id, facultyId: CS_FACULTY_ID },
          { electiveBatchId: batches[2]!.id, facultyId: CS_FACULTY_ID },
        ];
        const { status, json } = await api(
          "POST",
          "/department/course-assignment/upsert",
          this.tokens.dept,
          {
            courseId: this.courseId,
            semesterId: SEMESTER_ID,
            academicYear: ACADEMIC_YEAR,
            electiveBatchMappings,
          }
        );
        assert(
          status >= 200 && status < 300,
          `faculty mapping failed (${status}) ${JSON.stringify(json)}`
        );
      }
    );

    // ---- Submit + approve ----
    await this.step("Bulk submit courses", async () => {
      const { status, json } = await api(
        "POST",
        "/department/course/bulk-submit",
        this.tokens.dept,
        { semesterId: SEMESTER_ID }
      );
      assert(
        status >= 200 && status < 300,
        `bulk-submit failed (${status}) ${JSON.stringify(json)}`
      );
    });

    await this.step("Admin approves course", async () => {
      const { status, json } = await api(
        "POST",
        "/department/course/approve",
        this.tokens.admin,
        { semesterId: SEMESTER_ID, departmentId: CS_DEPT_ID }
      );
      assert(
        status >= 200 && status < 300,
        `approve failed (${status}) ${JSON.stringify(json)}`
      );
      const course = await db.course.findUnique({
        where: { id: this.courseId },
      });
      assert(
        course?.approvalStatus === "APPROVED",
        `expected APPROVED, got ${course?.approvalStatus}`
      );
    });

    // ---- Registration window + open ----
    await this.step("Create registration window (generic) + open", async () => {
      const { status, json } = await api(
        "POST",
        "/admin/registration-windows",
        this.tokens.admin,
        {
          academicTermId: ACADEMIC_TERM_ID,
          semesterId: SEMESTER_ID,
        }
      );
      assert(
        status >= 200 && status < 300,
        `window create failed (${status}) ${JSON.stringify(json)}`
      );
      const windowId = (json as { data?: { id?: string } })?.data?.id ?? "";
      this.createdWindowIds.push(windowId);
      assert(windowId, "window create returned no id");
      const toggle = await api(
        "PATCH",
        `/admin/registration-windows/${windowId}/toggle`,
        this.tokens.admin,
        {
          isOpen: true,
        }
      );
      assert(
        toggle.status >= 200 && toggle.status < 300,
        `window toggle failed (${toggle.status})`
      );
    });

    // ---- Register 6 students ----
    for (const student of STUDENTS) {
      await this.step(`Register ${student.usn}`, async () => {
        const { status, json } = await api(
          "POST",
          "/student/course-registration/submit",
          this.tokens[student.usn],
          { courseIds: [this.courseId] }
        );
        assert(
          status >= 200 && status < 300,
          `registration failed (${status}) ${JSON.stringify(json)}`
        );
      });
    }

    // ---- Elective mapping ----
    let detail: MappingDetail;
    await this.step("Load elective mapping detail", async () => {
      const { status, json } = await api(
        "GET",
        `/department/elective-mapping/${this.courseId}`,
        this.tokens.dept
      );
      assert(
        status >= 200 && status < 300,
        `detail failed (${status}) ${JSON.stringify(json)}`
      );
      detail = (json as { data: MappingDetail }).data;
      assert(
        detail.students.length === 6,
        `expected 6 students in detail, got ${detail.students.length}`
      );
      assert(
        detail.batches.length === 3,
        `expected 3 batches in detail, got ${detail.batches.length}`
      );
    });

    await this.step(
      "Save initial mapping (6 students across 3 batches, 2 each)",
      async () => {
        const assignments = detail.students.map((student, index) => ({
          studentId: student.studentId,
          electiveBatchId: detail.batches[index % 3]!.id,
        }));
        const { status, json } = await api(
          "PUT",
          "/department/elective-mapping/save",
          this.tokens.dept,
          {
            courseId: this.courseId,
            electiveMappingVersion: detail.electiveMappingVersion,
            assignments,
          }
        );
        assert(
          status >= 200 && status < 300,
          `save mapping failed (${status}) ${JSON.stringify(json)}`
        );
        const assignmentsDb = await db.electiveStudentAssignment.count({
          where: { courseId: this.courseId },
        });
        assert(
          assignmentsDb === 6,
          `expected 6 electiveStudentAssignments, got ${assignmentsDb}`
        );
      }
    );

    // ---- Reduce: delete one batch (cap 9->6, 6 registered ok) ----
    await this.step("Reduce to 2 batches via delete-batch", async () => {
      const detailRes = await api(
        "GET",
        `/department/elective-mapping/${this.courseId}`,
        this.tokens.dept
      );
      const latest = (detailRes.json as { data: MappingDetail }).data;
      const toDelete = latest.batches[2]!.id; // delete batch 3
      const { status, json } = await api(
        "POST",
        "/department/elective-mapping/delete-batch",
        this.tokens.dept,
        { electiveBatchId: toDelete }
      );
      assert(
        status >= 200 && status < 300,
        `delete-batch failed (${status}) ${JSON.stringify(json)}`
      );

      const batches = await db.electiveBatch.findMany({
        where: { courseId: this.courseId },
      });
      assert(
        batches.length === 2,
        `expected 2 batches after delete, got ${batches.length}`
      );
      const course = await db.course.findUnique({
        where: { id: this.courseId },
      });
      assert(
        course?.numberOfBatches === 2,
        `expected numberOfBatches 2, got ${course?.numberOfBatches}`
      );
      assert(
        course?.approvalStatus === "APPROVED",
        `course should remain APPROVED, got ${course?.approvalStatus}`
      );
    });

    // ---- Re-map by section (PA->b1, PB->b2, 3 each) ----
    await this.step(
      "Re-map 6 students into 2 batches filtered by section",
      async () => {
        const detailRes = await api(
          "GET",
          `/department/elective-mapping/${this.courseId}`,
          this.tokens.dept
        );
        const latest = (detailRes.json as { data: MappingDetail }).data;
        const batches = [...latest.batches].sort(
          (a, b) => a.sortOrder - b.sortOrder
        );
        assert(
          batches.length === 2,
          `expected 2 batches, got ${batches.length}`
        );
        const pa = latest.students.filter((s) => s.sectionName === "PA");
        const pb = latest.students.filter((s) => s.sectionName === "PB");
        assert(
          pa.length === 3 && pb.length === 3,
          `expected 3 PA + 3 PB, got ${pa.length} + ${pb.length}`
        );
        const assignments = [
          ...pa.map((s) => ({
            studentId: s.studentId,
            electiveBatchId: batches[0]!.id,
          })),
          ...pb.map((s) => ({
            studentId: s.studentId,
            electiveBatchId: batches[1]!.id,
          })),
        ];
        const { status, json } = await api(
          "PUT",
          "/department/elective-mapping/save",
          this.tokens.dept,
          {
            courseId: this.courseId,
            electiveMappingVersion: latest.electiveMappingVersion,
            assignments,
          }
        );
        assert(
          status >= 200 && status < 300,
          `re-map save failed (${status}) ${JSON.stringify(json)}`
        );
      }
    );

    // ---- Verify end state ----
    await this.step("Verify end state in DB", async () => {
      const batches = await db.electiveBatch.findMany({
        where: { courseId: this.courseId },
        orderBy: { sortOrder: "asc" },
      });
      assert(batches.length === 2, `expected 2 batches, got ${batches.length}`);
      const a = await db.electiveStudentAssignment.count({
        where: { courseId: this.courseId, electiveBatchId: batches[0]!.id },
      });
      const b = await db.electiveStudentAssignment.count({
        where: { courseId: this.courseId, electiveBatchId: batches[1]!.id },
      });
      assert(
        a === 3 && b === 3,
        `expected 3+3 assignments by batch, got ${a}+${b}`
      );
      const facultyRows = await db.electiveBatchFaculty.count({
        where: { courseId: this.courseId },
      });
      assert(facultyRows === 2, `expected 2 faculty rows, got ${facultyRows}`);
      const registrations = await db.courseRegistration.count({
        where: { courseId: this.courseId },
      });
      assert(
        registrations === 6,
        `expected 6 registrations, got ${registrations}`
      );
      const course = await db.course.findUnique({
        where: { id: this.courseId },
      });
      assert(
        course?.numberOfBatches === 2,
        `expected numberOfBatches 2, got ${course?.numberOfBatches}`
      );
      assert(
        course?.approvalStatus === "APPROVED",
        `expected APPROVED, got ${course?.approvalStatus}`
      );
    });

    // ---- Negative tests ----
    await this.runNegativeTests();

    // ---- Re-grow (C4 regression): close window, grow 2->3, no P2002 ----
    await this.step(
      "Re-grow batches 2->3 after mid-list delete (no name/sortOrder collision)",
      async () => {
        for (const windowId of this.createdWindowIds) {
          const toggle = await api(
            "PATCH",
            `/admin/registration-windows/${windowId}/toggle`,
            this.tokens.admin,
            {
              isOpen: false,
            }
          );
          assert(
            toggle.status >= 200 && toggle.status < 300,
            `window close failed (${toggle.status})`
          );
        }
        const { status, json } = await api(
          "PUT",
          "/admin/course",
          this.tokens.admin,
          {
            id: this.courseId,
            numberOfBatches: 3,
          }
        );
        assert(
          status >= 200 && status < 300,
          `re-grow update failed (${status}) ${JSON.stringify(json)}`
        );
        const batches = await db.electiveBatch.findMany({
          where: { courseId: this.courseId },
          orderBy: { sortOrder: "asc" },
        });
        assert(
          batches.length === 3,
          `expected 3 batches after re-grow, got ${batches.length}`
        );
        const names = batches.map((b) => b.name);
        const sortOrders = batches.map((b) => b.sortOrder);
        assert(
          sortOrders.every((v, i) => v === i + 1),
          `expected contiguous sortOrder 1..3, got ${JSON.stringify(sortOrders)}`
        );
        assert(
          names.every((n, i) => n === `${this.courseCode} ${i + 1}`),
          `expected names ${this.courseCode} 1..3, got ${JSON.stringify(names)}`
        );
        const course = await db.course.findUnique({
          where: { id: this.courseId },
        });
        assert(
          course?.numberOfBatches === 3,
          `expected numberOfBatches 3, got ${course?.numberOfBatches}`
        );
      }
    );
  }

  private async runNegativeTests(): Promise<void> {
    await this.step(
      "NEG: create PE with capacity below eligible students rejected",
      async () => {
        const code = `PE-E2E-NEG-${Date.now()}`;
        const { status, json } = await api(
          "POST",
          "/department/course",
          this.tokens.dept,
          {
            code,
            name: "E2E Neg Capacity",
            courseType: "PE",
            courseMode: "NON_INTEGRATED",
            departmentId: CS_DEPT_ID,
            semesterId: SEMESTER_ID,
            semesterNumber: 1,
            lectureCredits: 3,
            tutorialCredits: 0,
            practicalCredits: 0,
            skillCredits: 0,
            seeMaxMarks: 100,
            seeEligibility: 40,
            cieMaxMarks: 40,
            cieEligibility: 40,
            theoryMaxExams: 3,
            theoryMinExams: 2,
            theoryExamMaxMarks: 20,
            theoryCieContribution: 30,
            theoryEligibility: 40,
            labMaxMarks: 0,
            labEligibility: 0,
            aatMaxMarks: 10,
            aatEligibility: 40,
            numberOfBatches: 1,
            studentsPerBatch: 1,
          }
        );
        // capacity 1 < eligible 6 -> should be rejected (Phase1 hard-block)
        assert(
          status >= 400,
          `expected rejection, got ${status} ${JSON.stringify(json)}`
        );
      }
    );

    await this.step(
      "NEG: duplicate student in save assignments rejected",
      async () => {
        const detailRes = await api(
          "GET",
          `/department/elective-mapping/${this.courseId}`,
          this.tokens.dept
        );
        const latest = (detailRes.json as { data: MappingDetail }).data;
        const assignments = latest.students.map((s) => ({
          studentId: s.studentId,
          electiveBatchId: latest.batches[0]!.id,
        }));
        assignments.push(assignments[0]!); // duplicate
        const { status, json } = await api(
          "PUT",
          "/department/elective-mapping/save",
          this.tokens.dept,
          {
            courseId: this.courseId,
            electiveMappingVersion: latest.electiveMappingVersion,
            assignments,
          }
        );
        assert(
          status >= 400,
          `expected rejection for duplicates, got ${status} ${JSON.stringify(json)}`
        );
      }
    );

    await this.step("NEG: stale electiveMappingVersion rejected", async () => {
      const detailRes = await api(
        "GET",
        `/department/elective-mapping/${this.courseId}`,
        this.tokens.dept
      );
      const latest = (detailRes.json as { data: MappingDetail }).data;
      const { status, json } = await api(
        "PUT",
        "/department/elective-mapping/save",
        this.tokens.dept,
        {
          courseId: this.courseId,
          electiveMappingVersion: latest.electiveMappingVersion - 1,
          assignments: latest.students.map((s) => ({
            studentId: s.studentId,
            electiveBatchId: s.electiveBatchId,
          })),
        }
      );
      assert(
        status >= 400,
        `expected version conflict, got ${status} ${JSON.stringify(json)}`
      );
    });

    await this.step(
      "NEG: concurrent double-save on same course -> one 200, one 409",
      async () => {
        const detailRes = await api(
          "GET",
          `/department/elective-mapping/${this.courseId}`,
          this.tokens.dept
        );
        const latest = (detailRes.json as { data: MappingDetail }).data;
        const assignments = latest.students.map((s) => ({
          studentId: s.studentId,
          electiveBatchId: s.electiveBatchId,
        }));
        const payload = {
          courseId: this.courseId,
          electiveMappingVersion: latest.electiveMappingVersion,
          assignments,
        };
        const [r1, r2] = await Promise.all([
          api(
            "PUT",
            "/department/elective-mapping/save",
            this.tokens.dept,
            payload
          ),
          api(
            "PUT",
            "/department/elective-mapping/save",
            this.tokens.dept,
            payload
          ),
        ]);
        const statuses = [r1.status, r2.status].sort((a, b) => a - b);
        assert(
          statuses[0] === 200 && statuses[1] === 409,
          `expected one 200 + one 409, got ${JSON.stringify(statuses)}`
        );
      }
    );

    await this.step(
      "NEG: delete-batch below remaining capacity rejected",
      async () => {
        // capacity 2*3=6 currently; deleting one -> 1*3=3 < 6 registered -> rejected
        const detailRes = await api(
          "GET",
          `/department/elective-mapping/${this.courseId}`,
          this.tokens.dept
        );
        const latest = (detailRes.json as { data: MappingDetail }).data;
        const toDelete = latest.batches[0]!.id;
        const { status, json } = await api(
          "POST",
          "/department/elective-mapping/delete-batch",
          this.tokens.dept,
          { electiveBatchId: toDelete }
        );
        assert(
          status >= 400,
          `expected rejection, got ${status} ${JSON.stringify(json)}`
        );
      }
    );
  }

  async cleanup(): Promise<void> {
    try {
      for (const windowId of this.createdWindowIds) {
        await api(
          "PATCH",
          `/admin/registration-windows/${windowId}/toggle`,
          this.tokens.admin,
          { isOpen: false }
        );
        console.log(`  closed registration window ${windowId}`);
      }
    } catch (error) {
      console.log(`  window cleanup failed: ${(error as Error).message}`);
    }
    for (const code of this.createdCourseCodes) {
      try {
        const course = await db.course.findUnique({ where: { code } });
        if (course) {
          await db.courseRegistration.deleteMany({
            where: { courseId: course.id },
          });
          await db.course.delete({ where: { id: course.id } });
          console.log(`  cleaned up course ${code}`);
        }
      } catch (error) {
        console.log(
          `  course cleanup failed for ${code}: ${(error as Error).message}`
        );
      }
    }
  }
}

async function main() {
  const runner = new PeTestRun();
  try {
    await runner.run();
    console.log("\n✅ PE test run completed successfully.");
  } catch (error) {
    console.error(`\n❌ PE test run failed: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    await runner.cleanup();
  }
}

main();
