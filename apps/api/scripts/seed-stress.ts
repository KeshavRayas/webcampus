import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { redis } from "@webcampus/common/redis";
import { db } from "@webcampus/db";
import type {
  AcademicTerm,
  Department,
  Faculty,
  Semester,
  Student,
} from "@webcampus/db";
import { hashPassword } from "better-auth/crypto";

// ─────────────────────────────────────────────────────────────────────────────
// stress seed: builds a realistic academic domain graph on top of the existing
// user records so the full stress suite (all roles, GET + POST) has real data.
//
// Safe to run on a disposable DB (it is wiped after load testing). Passwords are
// normalized to "password" for every user. Redistribution of students across
// departments & semesters is kept fully consistent (semesterId / academicTermId /
// usn / username all updated together). The domain tables it manages are cleared
// first, so re-runs are deterministic.
// ─────────────────────────────────────────────────────────────────────────────

const PASSWORD = "password";
const ACADEMIC_YEAR = "2026";
const TERM_LABEL = "ODD 2026";
const TERM_TYPE = "odd" as const;
const UG_SEMESTERS = [1, 3, 5, 7];
const PG_SEMESTERS = [1, 3];

const MANIFEST_PATH =
  process.env.STRESS_MANIFEST_PATH ??
  path.resolve(process.cwd(), "stress-tests/.tmp/seed-manifest.json");

const log = (msg: string) => console.log(`[seed-stress] ${msg}`);

// Weighted distribution of 1000 students across departments (dept code -> weight).
const DEPARTMENT_WEIGHTS: Record<string, number> = {
  CS: 140,
  EC: 110,
  IS: 90,
  EE: 80,
  ME: 80,
  AD: 70,
  ML: 60,
  CE: 60,
  ET: 55,
  CD: 50,
  CI: 45,
  EI: 40,
  MD: 35,
  BT: 35,
  AE: 30,
  CB: 30,
  IM: 25,
  CH: 25,
  CA: 20,
  MS: 20,
  FY: 60,
  MA: 15,
  PH: 12,
  CY: 12,
};

type Manifest = {
  generatedAt: string;
  academicYear: string;
  academicTerm: { id: string; type: string; year: string; label: string };
  semesters: Record<string, string>;
  departments: Record<
    string,
    {
      id: string;
      name: string;
      code: string;
      facultyId?: string;
      courseIds?: string[];
    }
  >;
  users: Record<
    string,
    Array<{
      email: string;
      password: string;
      userId: string;
      studentId?: string;
      usn?: string;
      facultyId?: string;
      departmentId?: string;
      departmentName?: string;
      semesterId?: string;
      programType?: string;
      semesterNumber?: number;
      sectionId?: string;
      visibleCourseIds?: string[];
      feedbackRoundId?: string;
      feedbackAssignmentId?: string;
    }>
  >;
  sections: Array<{
    id: string;
    name: string;
    departmentId: string;
    semesterId: string;
    studentCount: number;
  }>;
  courses: Array<{
    id: string;
    code: string;
    departmentId: string;
    semesterId: string;
  }>;
  facultyHandling: Record<
    string,
    {
      courseAssignmentIds: string[];
      courseIds: string[];
      assignments: Array<{
        id: string;
        courseId: string;
        sectionId: string;
        semesterNumber: number;
      }>;
    }
  >;
  assessments: Record<string, string[]>;
  feedback: Record<string, { roundId: string; questionIds: string[] }>;
};

function pickWeighted(weights: Record<string, number>): string {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  if (entries.length === 0) return "";
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [code, w] of entries) {
    r -= w;
    if (r <= 0) return code;
  }
  return entries[entries.length - 1]![0];
}

function pushTo<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/** Runs `fn` for each item with bounded concurrency (default 25). */
async function mapPool<T, R>(
  items: T[],
  fn: (item: T, i: number) => Promise<R>,
  concurrency = 25
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (idx < items.length) {
        const i = idx++;
        out[i] = await fn(items[i]!, i);
      }
    }
  );
  await Promise.all(workers);
  return out;
}

const CHUNK = 500;
async function chunked<T>(
  items: T[],
  fn: (chunk: T[]) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK) {
    await fn(items.slice(i, i + CHUNK));
  }
}

// ── 0. Clear domain tables (FK-safe order) ──────────────────────────────────
async function clearDomain() {
  log("Clearing domain tables...");
  const tables = [
    "StudentQuestionMark",
    "StudentAssessment",
    "AssessmentQuestion",
    "AssessmentTemplate",
    "AttendanceRecord",
    "Attendance",
    "ClassSession",
    "CourseRegistration",
    "StudentSection",
    "HallTicket",
    "HallTicketVerificationLog",
    "HallTicketVerificationSetting",
    "TimetableEntry",
    "Freeze",
    "FeedbackAnswer",
    "FeedbackResponse",
    "FeedbackRound",
    "FeedbackQuestion",
    "FeedbackQuestionSet",
    "SupportTicketMessage",
    "SupportTicket",
    "ElectiveStudentAssignment",
    "ElectiveBatchFaculty",
    "ElectiveBatch",
    "CourseCoordinator",
    "OpenElectiveDepartment",
    "CourseMappingAuditLog",
    "Batch",
    "RegistrationWindow",
    "BonusAttendanceWindow",
    "CourseAssignment",
    "Section",
    "Course",
  ];
  for (const t of tables) {
    try {
      await db.$executeRawUnsafe(`DELETE FROM "${t}"`);
    } catch {
      // ignore if missing
    }
  }
  log("Domain tables cleared.");
}

// ── 1. Normalize passwords ──────────────────────────────────────────────────
async function normalizePasswords() {
  log("Normalizing all account passwords to 'password'...");
  const hash = await hashPassword(PASSWORD);
  const accounts = await db.account.findMany({
    where: { providerId: "credential" },
    select: { id: true },
  });
  await chunked(accounts, async (chunk) => {
    await db.account.updateMany({
      where: { id: { in: chunk.map((a) => a.id) } },
      data: { password: hash },
    });
  });
  log(`${accounts.length} credential accounts updated.`);
}

function usnFor(code: string, semesterNumber: number, seq: number): string {
  const code2 = code.slice(0, 2).toUpperCase();
  return `TBM26${code2}${semesterNumber}${String(seq).padStart(4, "0")}`;
}

// ── 2. Redistribute students ────────────────────────────────────────────────
async function redistributeStudents(
  departments: Map<string, Department>,
  semesters: Map<string, Semester>,
  term: AcademicTerm
): Promise<{ studentsByDept: Map<string, Student[]> }> {
  log("Redistributing students across departments & semesters...");

  const students = await db.student.findMany({
    select: { id: true, userId: true },
  });
  const deptCodes = [...departments.values()].map((d) => d.code);
  if (deptCodes.length === 0) return { studentsByDept: new Map() };

  // Clear prior USNs/usernames so re-runs don't collide with leftovers from an
  // earlier (partial) run on the same DB.
  await db.$executeRawUnsafe(`UPDATE "Student" SET usn = 'TMP' || id`);
  await db.$executeRawUnsafe(
    `UPDATE "user" SET username = 'TMP' || id, "displayUsername" = 'TMP' || id`
  );

  // A single global sequence guarantees unique USNs regardless of dept/semester,
  // which also makes the seed re-runnable on a DB that already holds seeded USNs.
  let seq = 0;
  const updates: {
    id: string;
    data: Parameters<typeof db.student.update>[0]["data"];
    userId: string;
  }[] = [];

  for (const student of students) {
    let deptCode = pickWeighted(DEPARTMENT_WEIGHTS);
    if (!departments.has(deptCode)) deptCode = deptCodes[0]!;

    const programType = Math.random() < 0.08 ? "PG" : "UG";
    const semPool = programType === "PG" ? PG_SEMESTERS : UG_SEMESTERS;
    const semesterNumber = semPool[Math.floor(Math.random() * semPool.length)]!;
    const semKey = `${programType}:${semesterNumber}`;
    const semester = semesters.get(semKey);
    if (!semester) continue;
    const dept = departments.get(deptCode);
    if (!dept) continue;

    seq += 1;
    const usn = usnFor(dept.code, semesterNumber, seq);

    updates.push({
      id: student.id,
      userId: student.userId,
      data: {
        departmentName: dept.name,
        currentSemester: semesterNumber,
        academicYear: ACADEMIC_YEAR,
        academicTermId: term.id,
        academicTermLabel: TERM_LABEL,
        academicTermType: TERM_TYPE,
        academicTermYear: ACADEMIC_YEAR,
        programType,
        semesterId: semester.id,
        semesterNumber,
        usn,
      },
    });
  }

  await mapPool(
    updates,
    async (u) => {
      await db.student.update({ where: { id: u.id }, data: u.data });
      await db.user.update({
        where: { id: u.userId },
        data: {
          username: (u.data as { usn: string }).usn,
          displayUsername: (u.data as { usn: string }).usn,
        },
      });
    },
    30
  );

  log(`${updates.length} students redistributed.`);

  const studentsByDept = new Map<string, Student[]>();
  const hydrated = await db.student.findMany({ include: { user: true } });
  for (const s of hydrated) pushTo(studentsByDept, s.departmentName, s);
  return { studentsByDept };
}

// ── Course catalog ──────────────────────────────────────────────────────────
const COURSE_NAMES = {
  THEORY: [
    "Engineering Mathematics",
    "Data Structures",
    "Algorithms",
    "Operating Systems",
    "Database Management Systems",
    "Computer Networks",
    "Software Engineering",
    "Machine Learning",
    "Digital Logic Design",
    "Discrete Mathematics",
    "Probability & Statistics",
    "Thermodynamics",
    "Fluid Mechanics",
    "Signals & Systems",
    "Control Systems",
    "Circuit Theory",
    "Engineering Physics",
    "Engineering Chemistry",
    "Design Thinking",
    "Professional Ethics",
    "Managerial Economics",
    "Communication Skills",
  ],
  LAB: [
    "Programming Lab",
    "Data Structures Lab",
    "Databases Lab",
    "Networks Lab",
    "Circuits Lab",
    "Physics Lab",
    "Chemistry Lab",
    "Machine Learning Lab",
  ],
};

// ── 3. Build domain graph ───────────────────────────────────────────────────
async function buildDomainGraph(
  term: AcademicTerm,
  semesters: Map<string, Semester>,
  departments: Map<string, Department>,
  facultyByDept: Map<string, Faculty>,
  studentsByDept: Map<string, Student[]>
) {
  log(
    "Building domain graph (courses, sections, assignments, registrations, attendance, marks, hall-tickets, timetable, feedback, support)..."
  );

  const courseIdsByDept = new Map<string, string[]>();
  const assignmentIdsByFaculty = new Map<string, string[]>();
  const assessmentsByAssignment = new Map<string, string[]>();
  const sectionsByDeptSem = new Map<string, string[]>();
  const sectionById = new Map<string, string>();
  const dayNames = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
  ] as const;

  for (const [deptName, deptStudents] of studentsByDept) {
    const dept = departments.get(deptName);
    if (!dept) continue;
    const faculty = facultyByDept.get(dept.id);
    if (!faculty) continue;

    // Group this department's students by semester key.
    const studentsBySemKey = new Map<string, Student[]>();
    for (const s of deptStudents) {
      if (!s.programType || !s.semesterNumber) continue;
      pushTo(studentsBySemKey, `${s.programType}:${s.semesterNumber}`, s);
    }

    for (const [semKey, students] of studentsBySemKey) {
      const semester = semesters.get(semKey);
      if (!semester) continue;
      const sectionKey = `${dept.id}:${semester.id}`;
      if (sectionsByDeptSem.has(sectionKey)) continue;

      const theoryPool = COURSE_NAMES.THEORY ?? [];
      const labPool = COURSE_NAMES.LAB ?? [];
      const numTheory = 6 + Math.floor(Math.random() * 3);
      const theoryNames = shuffle(theoryPool).slice(0, numTheory);
      const labNames = shuffle(labPool).slice(0, 2);
      const allNames = [
        ...theoryNames.map((n) => ({ name: n, type: "THEORY" as const })),
        ...labNames.map((n) => ({ name: n, type: "LAB" as const })),
      ];

      // ── Courses (batched) ────────────────────────────────────────────
      const prog = semester.programType === "PG" ? "PG" : "UG";
      // First-year UG students resolve their registration window scope by
      // section cycle, so sem-1 courses must carry a matching cycle (split
      // evenly between PHYSICS/CHEMISTRY) or their curriculum resolves empty.
      const isFirstYearUg = prog === "UG" && semester.semesterNumber === 1;
      const halfSplit = Math.ceil(allNames.length / 2);
      const cycleForIndex = (c: number) =>
        !isFirstYearUg
          ? ("NONE" as const)
          : c < halfSplit
            ? ("PHYSICS" as const)
            : ("CHEMISTRY" as const);
      const courseRows = allNames.map((spec, c) => {
        const isLab = spec.type === "LAB";
        return {
          code: `${dept.code}-${prog}${semester.semesterNumber}${String.fromCharCode(65 + c)}`,
          name: `${spec.name} (${dept.code} ${semester.semesterNumber})`,
          departmentName: dept.name,
          departmentId: dept.id,
          semesterId: semester.id,
          semesterNumber: semester.semesterNumber,
          courseMode: "NON_INTEGRATED" as const,
          courseType: "PC" as const,
          cycle: cycleForIndex(c),
          lectureCredits: isLab ? 0 : 3,
          tutorialCredits: 0,
          practicalCredits: isLab ? 1 : 0,
          skillCredits: 0,
          totalCredits: isLab ? 1 : 3,
          hasLaboratoryComponent: isLab,
          seeMaxMarks: 100,
          seeEligibility: 40,
          cieMaxMarks: 50,
          cieEligibility: 40,
          cieEligibilityPolicy: "COMPONENT_AND_OVERALL" as const,
          theoryExamMaxMarks: isLab ? 0 : 100,
          theoryMaxExams: isLab ? 0 : 3,
          theoryMinExams: isLab ? 0 : 2,
          theoryCieContribution: 50,
          theoryEligibility: 40,
          labMaxMarks: isLab ? 50 : 0,
          labEligibility: 40,
          aatMaxMarks: 0,
          aatEligibility: 40,
          allowFeedback: true,
          attendanceRequired: true,
          approvalStatus: "APPROVED" as const,
        };
      });
      await db.course.createMany({ data: courseRows });
      const createdCourses = await db.course.findMany({
        where: { departmentId: dept.id, semesterId: semester.id },
        select: { id: true },
      });
      const courseIds = createdCourses.map((c) => c.id);
      for (const id of courseIds) pushTo(courseIdsByDept, dept.id, id);

      // ── Sections (batched) ───────────────────────────────────────────
      const numSections = Math.max(1, Math.round(students.length / 60));
      const sectionRows = Array.from({ length: numSections }, (_, s) => ({
        name: `${dept.code}${String.fromCharCode(65 + s)}-${semester.semesterNumber}`,
        departmentName: dept.name,
        semesterId: semester.id,
        // First-year (sem 1) sections carry a Physics/Chemistry cycle so the
        // registration-window flow can resolve a cycle; later semesters don't.
        cycle:
          semester.semesterNumber === 1
            ? s % 2 === 0
              ? ("PHYSICS" as const)
              : ("CHEMISTRY" as const)
            : ("NONE" as const),
        departmentId: dept.id,
      }));
      await db.section.createMany({ data: sectionRows });
      const createdSections = await db.section.findMany({
        where: { departmentId: dept.id, semesterId: semester.id },
        select: { id: true, name: true },
      });
      const sectionIds = createdSections.map((s) => s.id);
      for (const s of createdSections) sectionById.set(s.id, s.name);
      sectionsByDeptSem.set(sectionKey, sectionIds);

      // Open registration window(s) for this dept+sem so students can submit.
      // Sem-1 dept-sems have PHYSICS and CHEMISTRY sections -> one window each.
      const windowCycles =
        semester.semesterNumber === 1
          ? (["PHYSICS", "CHEMISTRY"] as const)
          : ([null] as const);
      for (const cycle of windowCycles) {
        await db.registrationWindow
          .create({
            data: {
              academicTermId: term.id,
              semesterId: semester.id,
              departmentId: dept.id,
              cycle,
              isOpen: true,
            },
          })
          .catch(() => {});
      }

      // ── Student sections (batched) ───────────────────────────────────
      // NOTE: course registrations are intentionally NOT pre-created — the
      // stress run replays the real workflow where students submit their own
      // registration while the window is open.
      const studentSectionRows = students.map((student, i) => ({
        studentId: student.id,
        sectionId: sectionIds[i % sectionIds.length]!,
        semester: semester.semesterNumber,
        academicYear: ACADEMIC_YEAR,
      }));
      await db.studentSection.createMany({ data: studentSectionRows });

      // ── Course assignments + assessments (batched) ───────────────────
      // One assignment per (course, section) so students in EVERY section are
      // eligible for feedback / attendance / marks rosters (not just section A).
      // PC-only: no ElectiveBatch / PE handling.
      const timetableSectionId = sectionIds[0]!;
      const assignmentRows = sectionIds.flatMap((sectionId) =>
        courseIds.map((courseId) => ({
          courseId,
          facultyId: faculty.id,
          sectionId,
          batchId: null,
          assignmentType: "THEORY" as const,
          semester: semester.semesterNumber,
          academicYear: ACADEMIC_YEAR,
          departmentId: dept.id,
        }))
      );
      await db.courseAssignment.createMany({ data: assignmentRows });
      const createdAssignments = await db.courseAssignment.findMany({
        where: { courseId: { in: courseIds } },
        select: { id: true, courseId: true },
      });
      for (const a of createdAssignments) {
        pushTo(assignmentIdsByFaculty, faculty.id, a.id);
        assessmentsByAssignment.set(a.id, []);
      }

      // ── Course coordinators (required for bulkSubmit PENDING check) ───
      // One coordinator per course = the faculty who owns the dept.
      const coordinatorRows = courseIds.map((courseId) => ({
        courseId,
        facultyId: faculty.id,
      }));
      await db.courseCoordinator.createMany({
        data: coordinatorRows,
        skipDuplicates: true,
      });

      // ── Freeze rows (unfrozen initial state, required for hall-ticket gates)
      // Created per CourseAssignment, all flags false so faculty can later freeze.
      const freezeRows = createdAssignments.map((a) => ({
        id: randomUUID(),
        courseAssignmentId: a.id,
        facultyFrozen: false,
        hodFrozen: false,
        adminFrozen: false,
        finalFrozen: false,
      }));
      if (freezeRows.length > 0) {
        await db.freeze.createMany({ data: freezeRows, skipDuplicates: true });
      }

      // ── Assessment templates + questions (batched) ───────────────────
      // Templates are keyed per COURSE (unique [courseId, componentType,
      // sequence]) — every section's assignment of the course shares one.
      const assessmentRows = courseIds.map((courseId) => ({
        id: randomUUID(),
        courseId,
        semesterId: semester.id,
        title: `CIE-1 ${dept.code}`,
        totalMarks: 40,
        componentType: "THEORY" as const,
        sequence: 1,
      }));
      await db.assessmentTemplate.createMany({ data: assessmentRows });
      const assessmentByCourse = new Map<string, string>();
      for (const a of assessmentRows) assessmentByCourse.set(a.courseId, a.id);

      const questionRows = [];
      for (const a of assessmentRows) {
        const q = (part: string, n: string, marks: number, co: string) => ({
          id: randomUUID(),
          assessmentId: a.id,
          part,
          qNumber: n,
          marks,
          co,
          po: "PO1",
          bl: "L2",
        });
        questionRows.push(
          q("A", "1", 8, "CO1"),
          q("A", "2", 8, "CO2"),
          q("B", "3", 12, "CO3"),
          q("B", "4", 12, "CO4")
        );
      }
      await db.assessmentQuestion.createMany({ data: questionRows });
      const questionsByAssessment = new Map<
        string,
        { q1: string; q2: string }
      >();
      const allQuestions = await db.assessmentQuestion.findMany({
        where: { assessmentId: { in: assessmentRows.map((a) => a.id) } },
        select: { id: true, assessmentId: true, part: true, qNumber: true },
      });
      for (const q of allQuestions) {
        if (q.part === "A" && q.qNumber === "1") {
          const cur = questionsByAssessment.get(q.assessmentId) ?? {
            q1: "",
            q2: "",
          };
          cur.q1 = q.id;
          questionsByAssessment.set(q.assessmentId, cur);
        } else if (q.part === "A" && q.qNumber === "2") {
          const cur = questionsByAssessment.get(q.assessmentId) ?? {
            q1: "",
            q2: "",
          };
          cur.q2 = q.id;
          questionsByAssessment.set(q.assessmentId, cur);
        }
      }

      // ── Attendance + student assessments + question marks (batched) ──
      const attendanceRows = [];
      const studentAssessmentRows = [];
      const questionMarkRows = [];
      for (const student of students) {
        for (const a of assessmentRows) {
          const total = 20 + Math.floor(Math.random() * 10);
          const present = Math.max(
            0,
            Math.floor(total * (0.75 + Math.random() * 0.24))
          );
          attendanceRows.push({
            studentId: student.id,
            courseId: a.courseId,
            batchId: null,
            electiveBatchId: null,
            total,
            present,
            absent: total - present,
            condonationStatus: "NOT_REQUESTED" as const,
            percentage: total > 0 ? (present / total) * 100 : 0,
          });
          const obtained = Math.floor(Math.random() * 32) + 8;
          const saId = randomUUID();
          studentAssessmentRows.push({
            id: saId,
            studentId: student.id,
            assessmentId: a.id,
            courseId: a.courseId,
            totalMarks: obtained,
            status: "PRESENT",
          });
          const qs = questionsByAssessment.get(a.id);
          if (qs) {
            questionMarkRows.push(
              {
                id: randomUUID(),
                recordId: saId,
                questionId: qs.q1,
                marksObtained: obtained / 4,
              },
              {
                id: randomUUID(),
                recordId: saId,
                questionId: qs.q2,
                marksObtained: obtained / 4,
              }
            );
          }
        }
      }
      await chunked(attendanceRows, async (chunk) => {
        await db.attendance.createMany({ data: chunk, skipDuplicates: true });
      });
      await chunked(studentAssessmentRows, async (chunk) => {
        await db.studentAssessment.createMany({
          data: chunk,
          skipDuplicates: true,
        });
      });
      await chunked(questionMarkRows, async (chunk) => {
        await db.studentQuestionMark.createMany({
          data: chunk,
          skipDuplicates: true,
        });
      });

      // ── Timetable entries (batched) ──────────────────────────────────
      const timetableRows = Array.from({ length: 3 }, (_, t) => ({
        academicYear: ACADEMIC_YEAR,
        semesterId: semester.id,
        departmentId: dept.id,
        courseId: courseIds[t % courseIds.length]!,
        facultyId: faculty.id,
        roomNumber: `${dept.code}-${100 + t}`,
        dayOfWeek: dayNames[t % dayNames.length]!,
        startTime: `${8 + t}:00`,
        endTime: `${9 + t}:00`,
        classType: "LECTURE" as const,
        sectionId: timetableSectionId,
        batchId: null,
        status: "PUBLISHED" as const,
      }));
      await db.timetableEntry
        .createMany({ data: timetableRows })
        .catch(() => {});

      log(
        `  ${dept.code} sem ${semester.semesterNumber}: ${courseIds.length} courses, ${sectionIds.length} sections, ${students.length} students`
      );
    }
  }

  // ── Feedback question sets (10 questions) + enabled rounds for EVERY semester
  // The stress mix replays the real flow: admin configures the set per term +
  // semester, enables the round, then students submit while it is active.
  log("Creating feedback configuration for all semesters...");
  const adminUser = await db.user.findFirst({
    where: { role: "admin" },
    select: { id: true },
  });
  if (adminUser) {
    for (const semester of semesters.values()) {
      const qset = await db.feedbackQuestionSet
        .create({
          data: {
            academicTermId: term.id,
            semesterId: semester.id,
            isLocked: false,
            createdById: adminUser.id,
          },
        })
        .catch(() =>
          db.feedbackQuestionSet.findFirst({
            where: { semesterId: semester.id },
          })
        );
      if (!qset) continue;
      const existingQuestions = await db.feedbackQuestion.count({
        where: { questionSetId: qset.id },
      });
      if (existingQuestions === 0) {
        await db.feedbackQuestion.createMany({
          data: Array.from({ length: 10 }, (_, i) => ({
            questionSetId: qset.id,
            questionNumber: i + 1,
            questionText: `Stress feedback question ${i + 1}`,
          })),
        });
      }
      await db.feedbackRound
        .create({
          data: {
            academicTermId: term.id,
            semesterId: semester.id,
            questionSetId: qset.id,
            roundNumber: 1,
            name: "Stress Round",
            startsAt: new Date(Date.now() - 86400000),
            endsAt: new Date(Date.now() + 30 * 86400000),
            isEnabled: true,
            createdById: adminUser.id,
          },
        })
        .catch(() => {});
    }
  }

  // ── Support tickets (a handful, batched) ─────────────────────────────
  log("Creating support tickets...");
  const someStudents = await db.student.findMany({
    take: 20,
    select: { userId: true },
  });
  const ticketRows = someStudents.map((s, i) => ({
    id: randomUUID(),
    ticketNumber: `STRESS-${1000 + i}`,
    subject: "Stress test support ticket",
    category: "OTHER" as const,
    status: "OPEN" as const,
    priority: "MEDIUM" as const,
    createdById: s.userId,
  }));
  await db.supportTicket.createMany({ data: ticketRows }).catch(() => {});

  // Ensure no stale hall-tickets block the send step (fresh DB should have none)
  // Freeze rows are intentionally left unfrozen so the staged run can freeze in order.

  return {
    sectionsByDeptSem,
    assignmentIdsByFaculty,
    assessmentsByAssignment,
    courseIdsByDept,
    sectionById,
  };
}

// ── 4. Build manifest ───────────────────────────────────────────────────────
async function buildManifest(
  term: AcademicTerm,
  semesters: Map<string, Semester>,
  departments: Map<string, Department>,
  facultyByDept: Map<string, Faculty>,
  assignmentIdsByFaculty: Map<string, string[]>,
  assessmentsByAssignment: Map<string, string[]>,
  sectionsByDeptSem: Map<string, string[]>,
  courseIdsByDept: Map<string, string[]>
): Promise<Manifest> {
  const users: Manifest["users"] = {
    student: [],
    faculty: [],
    department: [],
    admin: [],
    coe: [],
    accounts: [],
    admission: [],
    "admission-instructor": [],
  };

  const students = await db.student.findMany({ include: { user: true } });

  // ── Lookup data for student enrichment ────────────────────────────────
  const [studentSections, allSectionRows, allCourseRows, rounds] =
    await Promise.all([
      db.studentSection.findMany({
        select: { studentId: true, sectionId: true },
      }),
      db.section.findMany({
        select: { id: true, cycle: true, semesterId: true, departmentId: true },
      }),
      db.course.findMany({
        select: { id: true, departmentId: true, semesterId: true, cycle: true },
      }),
      db.feedbackRound.findMany({
        where: { academicTermId: term.id, isEnabled: true },
        select: { id: true, semesterId: true, questionSetId: true },
      }),
    ]);
  const sectionByStudentId = new Map<string, string>();
  for (const ss of studentSections)
    sectionByStudentId.set(ss.studentId, ss.sectionId);
  const sectionCycleById = new Map(allSectionRows.map((s) => [s.id, s.cycle]));

  const feedbackRoundBySemester = new Map(rounds.map((r) => [r.semesterId, r]));
  const feedbackQuestions = await db.feedbackQuestion.findMany({
    where: { questionSetId: { in: rounds.map((r) => r.questionSetId) } },
    select: { id: true, questionSetId: true, questionNumber: true },
    orderBy: { questionNumber: "asc" },
  });

  const assignmentsForFeedback = await db.courseAssignment.findMany({
    select: { id: true, courseId: true, sectionId: true },
  });
  // First assignment (by course order) per section — used as the feedback target.
  const firstAssignmentBySectionCourse = new Map<string, string>();
  for (const a of assignmentsForFeedback) {
    const key = `${a.sectionId}:${a.courseId}`;
    if (!firstAssignmentBySectionCourse.has(key))
      firstAssignmentBySectionCourse.set(key, a.id);
  }

  const studentList = users.student ?? [];
  for (const s of students) {
    const sectionId = sectionByStudentId.get(s.id);
    const deptEntry = s.departmentName
      ? departments.get(s.departmentName)
      : undefined;
    let visibleCourseIds: string[] = [];
    if (deptEntry && s.semesterId) {
      const candidates = allCourseRows.filter(
        (c) => c.departmentId === deptEntry.id && c.semesterId === s.semesterId
      );
      // Mirror getApprovedInstanceCourses: first-year UG students only see
      // courses whose cycle matches their own section's cycle.
      const isFirstYearUg = s.programType === "UG" && s.semesterNumber === 1;
      const studentCycle = sectionId
        ? sectionCycleById.get(sectionId)
        : undefined;
      visibleCourseIds = (
        isFirstYearUg && studentCycle && studentCycle !== "NONE"
          ? candidates.filter((c) => c.cycle === studentCycle)
          : candidates
      ).map((c) => c.id);
    }
    const round = s.semesterId
      ? feedbackRoundBySemester.get(s.semesterId)
      : undefined;
    let feedbackAssignmentId: string | undefined;
    if (sectionId) {
      const visible = new Set(visibleCourseIds);
      for (const courseId of visibleCourseIds) {
        const found = firstAssignmentBySectionCourse.get(
          `${sectionId}:${courseId}`
        );
        if (found && visible.has(courseId)) {
          feedbackAssignmentId = found;
          break;
        }
      }
    }
    studentList.push({
      email: s.user.email,
      password: PASSWORD,
      userId: s.userId,
      studentId: s.id,
      departmentName: s.departmentName,
      usn: s.usn,
      semesterId: s.semesterId ?? undefined,
      programType: s.programType ?? undefined,
      semesterNumber: s.semesterNumber ?? undefined,
      sectionId: sectionId ?? undefined,
      visibleCourseIds,
      feedbackRoundId: round?.id,
      feedbackAssignmentId,
    });
  }

  const questionsBySet = new Map<string, string[]>();
  for (const q of feedbackQuestions) {
    pushTo(questionsBySet, q.questionSetId, q.id);
  }
  const feedbackMap: Manifest["feedback"] = {};
  for (const r of rounds) {
    const qs = questionsBySet.get(r.questionSetId) ?? [];
    if (qs.length > 0)
      feedbackMap[r.semesterId] = { roundId: r.id, questionIds: qs };
  }

  const faculty = await db.faculty.findMany({ include: { user: true } });
  const facultyList = users.faculty ?? [];
  for (const f of faculty) {
    facultyList.push({
      email: f.user.email,
      password: PASSWORD,
      userId: f.userId,
      facultyId: f.id,
      departmentId: f.departmentId,
      departmentName: departments.get(f.departmentId)?.name,
    });
  }

  const deptUsers = await db.user.findMany({ where: { role: "department" } });
  const deptList = users.department ?? [];
  for (const u of deptUsers) {
    const dept = await db.department.findFirst({ where: { userId: u.id } });
    deptList.push({
      email: u.email,
      password: PASSWORD,
      userId: u.id,
      departmentId: dept?.id,
      departmentName: dept?.name,
    });
  }

  const singleRoleUsers = await db.user.findMany({
    where: {
      role: {
        in: ["admin", "coe", "accounts", "admission", "admission-instructor"],
      },
    },
  });
  for (const u of singleRoleUsers) {
    const list = users[u.role as keyof Manifest["users"]];
    if (list) list.push({ email: u.email, password: PASSWORD, userId: u.id });
  }

  const semestersMap: Record<string, string> = {};
  for (const [key, s] of semesters) semestersMap[key] = s.id;

  const deptMap: Manifest["departments"] = {};
  for (const [name, d] of departments) {
    deptMap[name] = {
      id: d.id,
      name: d.name,
      code: d.code,
      facultyId: facultyByDept.get(d.id)?.id,
      courseIds: courseIdsByDept.get(d.id) ?? [],
    };
  }

  const sections: Manifest["sections"] = [];
  for (const [, sectionIds] of sectionsByDeptSem) {
    const secs = await db.section.findMany({
      where: { id: { in: sectionIds } },
      include: { _count: { select: { studentSections: true } } },
    });
    for (const sec of secs) {
      sections.push({
        id: sec.id,
        name: sec.name,
        departmentId: sec.departmentId,
        semesterId: sec.semesterId,
        studentCount: sec._count.studentSections,
      });
    }
  }

  const allCourses = await db.course.findMany({
    select: { id: true, code: true, departmentId: true, semesterId: true },
  });
  const courses: Manifest["courses"] = allCourses.map((c) => ({
    id: c.id,
    code: c.code,
    departmentId: c.departmentId,
    semesterId: c.semesterId,
  }));

  const deptIdByFacultyId = new Map<string, string>();
  for (const [, f] of facultyByDept)
    deptIdByFacultyId.set(f.id, f.departmentId);

  // Per-assignment tuples so the stress mix can pair (course, section) the way
  // the real workflow does — required for marks/attendance eligibility checks.
  const allAssignmentRows = await db.courseAssignment.findMany({
    select: { id: true, facultyId: true, courseId: true, sectionId: true },
  });
  const semesterIdByCourse = new Map(
    allCourseRows.map((c) => [c.id, c.semesterId])
  );
  const assignmentsByFaculty = new Map<
    string,
    Manifest["facultyHandling"][string]["assignments"]
  >();
  for (const a of allAssignmentRows) {
    const list = assignmentsByFaculty.get(a.facultyId) ?? [];
    list.push({
      id: a.id,
      courseId: a.courseId,
      sectionId: a.sectionId,
      semesterNumber:
        semesters.get(semesterIdByCourse.get(a.courseId) ?? "")
          ?.semesterNumber ?? 0,
    });
    assignmentsByFaculty.set(a.facultyId, list);
  }

  const facultyHandling: Manifest["facultyHandling"] = {};
  for (const [facultyId, ids] of assignmentIdsByFaculty) {
    facultyHandling[facultyId] = {
      courseAssignmentIds: ids,
      courseIds:
        courseIdsByDept.get(deptIdByFacultyId.get(facultyId) ?? "") ?? [],
      assignments: assignmentsByFaculty.get(facultyId) ?? [],
    };
  }

  const assessments: Manifest["assessments"] = {};
  for (const [assignmentId] of assessmentsByAssignment) {
    const a = await db.courseAssignment.findUnique({
      where: { id: assignmentId },
      select: { courseId: true },
    });
    if (!a) continue;
    const tpls = await db.assessmentTemplate.findMany({
      where: { courseId: a.courseId },
      select: { id: true },
    });
    assessments[assignmentId] = tpls.map((t) => t.id);
  }

  return {
    generatedAt: new Date().toISOString(),
    academicYear: ACADEMIC_YEAR,
    academicTerm: {
      id: term.id,
      type: term.type,
      year: term.year,
      label: TERM_LABEL,
    },
    semesters: semestersMap,
    departments: deptMap,
    users,
    sections,
    courses,
    facultyHandling,
    assessments,
    feedback: feedbackMap,
  };
}

async function main() {
  log("Starting stress seed...");
  const startedAt = Date.now();

  const term = await db.academicTerm.findFirst({ where: { isCurrent: true } });
  if (!term)
    throw new Error("No current academic term found. Run mock:start first.");

  const allSemesters = await db.semester.findMany();
  const semesters = new Map<string, Semester>();
  for (const s of allSemesters)
    semesters.set(`${s.programType}:${s.semesterNumber}`, s);

  const allDepartments = await db.department.findMany();
  const departments = new Map<string, Department>();
  for (const d of allDepartments) {
    departments.set(d.name, d);
    if (d.code) departments.set(d.code, d);
  }

  const allFaculty = await db.faculty.findMany();
  const facultyByDept = new Map<string, Faculty>();
  for (const f of allFaculty) facultyByDept.set(f.departmentId, f);

  await clearDomain();
  await normalizePasswords();

  const { studentsByDept } = await redistributeStudents(
    departments,
    semesters,
    term
  );

  const {
    sectionsByDeptSem,
    assignmentIdsByFaculty,
    assessmentsByAssignment,
    courseIdsByDept,
  } = await buildDomainGraph(
    term,
    semesters,
    departments,
    facultyByDept,
    studentsByDept
  );

  const manifest = await buildManifest(
    term,
    semesters,
    departments,
    facultyByDept,
    assignmentIdsByFaculty,
    assessmentsByAssignment,
    sectionsByDeptSem,
    courseIdsByDept
  );

  mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  log(`Manifest written to ${MANIFEST_PATH}`);

  log(
    `Stress seed complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`
  );
}

main()
  .catch((error) => {
    console.error(`[seed-stress] Fatal: ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([redis.quit(), db.$disconnect()]);
  });
