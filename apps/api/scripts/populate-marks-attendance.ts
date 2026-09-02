import "dotenv/config";
import { isBatchManagedCourse } from "@webcampus/api/src/services/shared/course-kind";
import { resolveActiveRegistrationsForCourse } from "@webcampus/api/src/services/shared/course-registration-resolver";
import { recomputeCourseMarks } from "@webcampus/api/src/services/shared/mark-sync.service";
import { PeCapacityService } from "@webcampus/api/src/services/shared/pe-capacity.service";
import { db, Prisma } from "@webcampus/db";
import {
  buildAssessmentSlots,
  findAssessmentForSlot,
} from "@webcampus/schemas/faculty";
import {
  buildQuestionMarkUpsert,
  chunk,
  type QuestionMarkRow,
} from "./populate-batch";

const DRY_RUN = process.argv.includes("--dry-run");
const VERIFY_ONLY = process.argv.includes("--verify");
const SESSIONS_PER_COURSE = 12;
const PRESENT_RATE = 0.8;
const WIPE_SESSIONS = true;
const SEED = (() => {
  const flag = process.argv.find((arg) => arg.startsWith("--seed="));
  return flag ? Number(flag.split("=")[1]) : 42;
})();

// Concurrent updates per Promise.all batch — polite to PgBouncer
// (DATABASE_URL uses connection_limit=20).
const UPDATE_CHUNK = 20;
// Rows per raw upsert statement (4 params each).
const SQL_CHUNK = 1000;

type Tier = "T1" | "T2" | "T3";

interface QuestionRef {
  id: string;
  marks: number;
}

interface AssessmentRef {
  id: string;
  title: string;
  totalMarks: number;
  componentType: "THEORY" | "LAB" | "AAT";
  sequence: number;
  questions: QuestionRef[];
}

interface OwnerRef {
  key: string;
  userId: string;
  electiveBatchId?: string;
}

interface TargetCourse {
  id: string;
  code: string;
  name: string;
  semesterId: string;
  courseType: string | null;
  cieMaxMarks: number;
  cieEligibility: number;
  theoryMaxExams: number;
  theoryExamMaxMarks: number;
  labMaxMarks: number;
  aatMaxMarks: number;
  assessments: AssessmentRef[];
  owners: OwnerRef[];
  frozen: boolean;
  isBatchManaged: boolean;
}

async function fetchTargetCourses(): Promise<TargetCourse[]> {
  const courses = await db.course.findMany({
    where: {
      approvalStatus: "APPROVED",
      coordinators: { some: {} },
    },
    select: {
      id: true,
      code: true,
      name: true,
      semesterId: true,
      courseType: true,
      cieMaxMarks: true,
      cieEligibility: true,
      theoryMaxExams: true,
      theoryExamMaxMarks: true,
      labMaxMarks: true,
      aatMaxMarks: true,
      assessments: {
        select: {
          id: true,
          title: true,
          totalMarks: true,
          componentType: true,
          sequence: true,
          questions: {
            select: { id: true, marks: true },
            orderBy: { qNumber: "asc" },
          },
        },
      },
      assignments: {
        select: {
          faculty: { select: { userId: true } },
          freezes: {
            select: { facultyFrozen: true, hodFrozen: true, adminFrozen: true },
          },
        },
      },
      electiveBatchFaculties: {
        select: {
          electiveBatchId: true,
          faculty: { select: { userId: true } },
          freeze: {
            select: { facultyFrozen: true, hodFrozen: true, adminFrozen: true },
          },
        },
      },
    },
    orderBy: { code: "asc" },
  });

  return courses.map((course) => {
    const assignmentFreezes = course.assignments.flatMap((a) =>
      a.freezes ? [a.freezes] : []
    );
    const batchFreezes = course.electiveBatchFaculties.flatMap((b) =>
      b.freeze ? [b.freeze] : []
    );
    const frozen = [...assignmentFreezes, ...batchFreezes].some(
      (f) => f.facultyFrozen || f.hodFrozen || f.adminFrozen
    );
    const isBatchManaged = isBatchManagedCourse(course.courseType);
    return {
      ...course,
      frozen,
      isBatchManaged,
      owners: isBatchManaged
        ? course.electiveBatchFaculties.map((row) => ({
            key: row.electiveBatchId,
            userId: row.faculty.userId,
            electiveBatchId: row.electiveBatchId,
          }))
        : course.assignments.map((row) => ({
            key: row.faculty.userId,
            userId: row.faculty.userId,
          })),
    };
  });
}

function isQpComplete(course: TargetCourse): boolean {
  return buildAssessmentSlots(course).every(
    (slot) => !!findAssessmentForSlot(course.assessments, slot)
  );
}

function hashSeed(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFor(key: string): () => number {
  return mulberry32(hashSeed(`pop-marks:${key}`)());
}

function seededShuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = arr[i] as T;
    const b = arr[j] as T;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

function assignTiers(
  studentIds: string[],
  courseKey: string
): Map<string, Tier> {
  const rng = rngFor(`${SEED}:${courseKey}`);
  const shuffled = seededShuffle(studentIds, rng);
  const third = Math.floor(shuffled.length / 3);
  const tiers = new Map<string, Tier>();
  shuffled.forEach((studentId, index) => {
    if (index < shuffled.length - 2 * third) {
      tiers.set(studentId, "T1");
    } else if (index < shuffled.length - third) {
      tiers.set(studentId, "T2");
    } else {
      tiers.set(studentId, "T3");
    }
  });
  return tiers;
}

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Integer split of `target` across questions proportional to their mark
 * weights (largest remainder), clamped to each question's max so the
 * StudentQuestionMark rows always sum exactly to the intended total.
 */
function splitAcrossQuestions(
  target: number,
  questions: QuestionRef[],
  rng: () => number
): Array<{ questionId: string; marksObtained: number }> {
  const totalWeight = questions.reduce((sum, q) => sum + q.marks, 0);
  if (totalWeight <= 0 || target <= 0 || questions.length === 0) {
    return questions.map((q) => ({ questionId: q.id, marksObtained: 0 }));
  }
  const goal = Math.min(Math.round(target), totalWeight);
  const ideal = questions.map((q) => (goal * q.marks) / totalWeight);
  const alloc: number[] = ideal.map((v) => Math.floor(v));
  let remaining = goal - alloc.reduce((sum, v) => sum + v, 0);
  const byFraction = ideal
    .map((v, index) => ({
      index,
      frac: v - Math.floor(v),
      cap: questions[index]?.marks ?? 0,
    }))
    .sort((a, b) => b.frac - a.frac || (rng() < 0.5 ? -1 : 1));
  for (const { index, cap } of byFraction) {
    if (remaining <= 0) break;
    if ((alloc[index] ?? 0) < cap) {
      alloc[index] = (alloc[index] ?? 0) + 1;
      remaining--;
    }
  }
  for (let step = 0; step < questions.length * 2 && remaining > 0; step++) {
    const index = step % questions.length;
    const cap = questions[index]?.marks ?? 0;
    if ((alloc[index] ?? 0) < cap) {
      alloc[index] = (alloc[index] ?? 0) + 1;
      remaining--;
    }
  }
  return questions.map((q, index) => ({
    questionId: q.id,
    marksObtained: alloc[index] ?? 0,
  }));
}

function tierMarkFraction(
  tier: Tier,
  rng: () => number,
  passThresholdPct: number
): number {
  const threshold = passThresholdPct / 100;
  if (tier === "T3") {
    const max = Math.max(0.05, Math.min(0.3, threshold - 0.05));
    const min = Math.max(0.02, max * 0.4);
    return min + rng() * (max - min);
  }
  const min = Math.min(0.97, Math.max(0.75, threshold + 0.08));
  return min + rng() * (0.97 - min);
}

async function resolveRoster(
  course: TargetCourse,
  owner: OwnerRef
): Promise<Array<{ studentId: string }>> {
  const registrations = await db.courseRegistration.findMany({
    where: {
      courseId: course.id,
      semesterId: course.semesterId,
      status: "ACTIVE",
      registrationType: { in: ["REGULAR", "RE_REGISTRATION"] },
    },
    select: { studentId: true },
  });
  if (!owner.electiveBatchId) {
    return registrations;
  }
  const batchStudents = await db.electiveStudentAssignment.findMany({
    where: { courseId: course.id, electiveBatchId: owner.electiveBatchId },
    select: { studentId: true },
  });
  const allowed = await PeCapacityService.getFacultyPeRoster(
    (
      await db.faculty.findUniqueOrThrow({
        where: { userId: owner.userId },
        select: { id: true },
      })
    ).id,
    course.id
  );
  const peAllowed = new Set(allowed.map((r) => r.studentId));
  const batchSet = new Set(batchStudents.map((b) => b.studentId));
  return registrations.filter(
    (reg) => batchSet.has(reg.studentId) && peAllowed.has(reg.studentId)
  );
}

interface StudentTotalEntry {
  studentId: string;
  totalMarks: number;
  status: "PRESENT" | "ABSENT" | "MP";
}

/**
 * Batched replacement for Mark.saveAssessmentMarks (script context only —
 * auth/freeze/PE checks are done upstream by the script's own filters).
 * 1 findMany + 1 createMany + chunked updates for StudentAssessment,
 * 1 raw upsert per 1000 question marks.
 */
async function saveAssessmentBatch(
  course: TargetCourse,
  assessment: AssessmentRef,
  studentTotals: StudentTotalEntry[],
  marks: Array<{
    studentId: string;
    questionId: string;
    marksObtained: number;
  }>,
  registrationByStudent: Map<string, { id: string }>,
  stats: RunStats
): Promise<void> {
  const registered = studentTotals.filter((t) =>
    registrationByStudent.has(t.studentId)
  );
  stats.studentsAssessed += registered.length;

  // Existing attempt-scoped rows for this assessment — one query.
  const registrationIds = registered.map(
    (t) => registrationByStudent.get(t.studentId)!.id
  );
  const existing =
    registrationIds.length > 0
      ? await db.studentAssessment.findMany({
          where: {
            assessmentId: assessment.id,
            courseRegistrationId: { in: registrationIds },
          },
          select: { id: true, courseRegistrationId: true },
        })
      : [];
  const recordIdByStudent = new Map<string, string>();
  const toCreate: Prisma.StudentAssessmentCreateManyInput[] = [];
  const toUpdate: Array<{
    id: string;
    totalMarks: number;
    status: string;
  }> = [];
  for (const entry of registered) {
    const registrationId = registrationByStudent.get(entry.studentId)!.id;
    const existingRow = existing.find(
      (row) => row.courseRegistrationId === registrationId
    );
    if (existingRow) {
      toUpdate.push({
        id: existingRow.id,
        totalMarks: entry.totalMarks,
        status: entry.status,
      });
      recordIdByStudent.set(entry.studentId, existingRow.id);
    } else {
      // Pre-generate the id so question marks can reference it without
      // createManyAndReturn.
      const id = crypto.randomUUID();
      toCreate.push({
        id,
        studentId: entry.studentId,
        assessmentId: assessment.id,
        courseId: course.id,
        totalMarks: entry.totalMarks,
        status: entry.status,
        courseRegistrationId: registrationId,
      });
      recordIdByStudent.set(entry.studentId, id);
    }
  }

  if (toCreate.length > 0) {
    await db.studentAssessment.createMany({ data: toCreate });
  }
  for (const batch of chunk(toUpdate, UPDATE_CHUNK)) {
    await Promise.all(
      batch.map((u) =>
        db.studentAssessment.update({
          where: { id: u.id },
          data: { totalMarks: u.totalMarks, status: u.status },
        })
      )
    );
  }
  stats.assessmentsPopulated++;

  // Question marks: one bulk upsert per chunk (uses @@unique(recordId, questionId)).
  const rows: QuestionMarkRow[] = marks
    .filter((m) => recordIdByStudent.has(m.studentId))
    .map((m) => ({
      id: crypto.randomUUID(),
      recordId: recordIdByStudent.get(m.studentId)!,
      questionId: m.questionId,
      marksObtained: m.marksObtained,
    }));
  for (const batch of chunk(rows, SQL_CHUNK)) {
    const { sql, params } = buildQuestionMarkUpsert(batch);
    await db.$executeRawUnsafe(sql, ...params);
  }
}

/**
 * Batched replacement for the per-student Attendance.create/update loop.
 * One findMany + one createMany + chunked concurrent updates.
 */
async function syncAttendanceBatch(
  course: TargetCourse,
  owner: OwnerRef,
  tiers: Array<[string, Tier]>,
  rng: () => number,
  registrationByStudent: Map<string, { id: string }>,
  stats: RunStats
): Promise<void> {
  const studentIds = tiers.map(([studentId]) => studentId);
  const existingRows = await db.attendance.findMany({
    where: {
      courseId: course.id,
      batchId: null,
      electiveBatchId: owner.electiveBatchId ?? null,
      studentId: { in: studentIds },
    },
    select: { id: true, studentId: true },
  });
  const existingByStudent = new Map(
    existingRows.map((row) => [row.studentId, row.id])
  );

  const creates: Prisma.AttendanceCreateManyInput[] = [];
  const updates: Array<{
    id: string;
    total: number;
    present: number;
    absent: number;
    percentage: number;
  }> = [];

  for (const [studentId, tier] of tiers) {
    // Same draw order as before: totalClasses then presentPct per student.
    const totalClasses = randomInt(rng, 30, 42);
    const band =
      tier === "T1"
        ? ([85, 100] as const)
        : tier === "T2"
          ? ([75, 84] as const)
          : ([40, 70] as const);
    const presentPct = randomInt(rng, band[0], band[1]);
    const present = Math.round((totalClasses * presentPct) / 100);
    const absent = totalClasses - present;
    const percentage = Number(((present / totalClasses) * 100).toFixed(2));

    const existingId = existingByStudent.get(studentId);
    if (existingId) {
      updates.push({
        id: existingId,
        total: totalClasses,
        present,
        absent,
        percentage,
      });
    } else {
      creates.push({
        studentId,
        courseId: course.id,
        batchId: null,
        electiveBatchId: owner.electiveBatchId ?? null,
        total: totalClasses,
        present,
        absent,
        percentage,
        condonationStatus: "NOT_REQUESTED",
        courseRegistrationId: registrationByStudent.get(studentId)?.id ?? null,
      });
    }
  }

  if (creates.length > 0) {
    await db.attendance.createMany({ data: creates });
  }
  for (const batch of chunk(updates, UPDATE_CHUNK)) {
    await Promise.all(
      batch.map((u) =>
        db.attendance.update({
          where: { id: u.id },
          data: {
            total: u.total,
            present: u.present,
            absent: u.absent,
            percentage: u.percentage,
          },
        })
      )
    );
  }
  stats.attendanceCreated += creates.length;
  stats.attendanceUpdated += updates.length;
}

async function syncSessionsBatch(
  course: TargetCourse,
  owner: OwnerRef,
  studentIds: string[],
  presentRate: number,
  sessionCount: number
) {
  const courseRow = await db.course.findUnique({
    where: { id: course.id },
    select: { semesterId: true },
  });
  const semester = courseRow
    ? await db.semester.findUnique({
        where: { id: courseRow.semesterId },
        select: { startDate: true, endDate: true },
      })
    : null;
  const start = semester?.startDate
    ? new Date(semester.startDate)
    : new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 4);
  const end = semester?.endDate ? new Date(semester.endDate) : new Date();
  const faculty = await db.faculty.findUnique({
    where: { userId: owner.userId },
    select: { id: true },
  });
  if (!faculty) return;
  const assignments = await db.courseAssignment.findMany({
    where: { courseId: course.id, facultyId: faculty.id },
    select: { sectionId: true, batchId: true },
  });
  // Handle batch-managed PE/PW via electiveBatch
  if (owner.electiveBatchId) {
    const eb = await db.electiveBatch.findUnique({
      where: { id: owner.electiveBatchId },
      select: { id: true, sectionId: true },
    });
    if (eb) {
      if (WIPE_SESSIONS) {
        const toDel = await db.classSession.findMany({
          where: {
            courseId: course.id,
            electiveBatchId: eb.id,
            facultyId: faculty.id,
            sessionDate: { gte: start, lte: end },
          },
          select: { id: true },
        });
        if (toDel.length > 0) {
          await db.attendanceRecord.deleteMany({
            where: { sessionId: { in: toDel.map((x) => x.id) } },
          });
          await db.classSession.deleteMany({
            where: { id: { in: toDel.map((x) => x.id) } },
          });
        }
      }
      const dates: Date[] = [];
      const totalMs = end.getTime() - start.getTime();
      const step = totalMs / Math.max(1, sessionCount);
      for (let i = 0; i < sessionCount; i++) {
        const d = new Date(start.getTime() + i * step + step * 0.2);
        d.setHours(9, 0, 0, 0);
        dates.push(d);
      }
      let enrolled = studentIds;
      const batchStudents = await db.electiveStudentAssignment.findMany({
        where: { electiveBatchId: eb.id },
        select: { studentId: true },
      });
      if (batchStudents.length > 0)
        enrolled = batchStudents
          .map((x) => x.studentId)
          .filter((id) => studentIds.includes(id));
      if (enrolled.length === 0) enrolled = studentIds;
      for (let i = 0; i < dates.length; i++) {
        const dVal = dates[i]!;
        let sess = await db.classSession.findFirst({
          where: {
            courseId: course.id,
            electiveBatchId: eb.id,
            facultyId: faculty.id,
            sessionDate: dVal,
            timingCode: "T" + (i + 1),
          },
        });
        if (!sess) {
          sess = await db.classSession.create({
            data: {
              id: crypto.randomUUID(),
              courseId: course.id,
              sectionId: eb.sectionId || null,
              facultyId: faculty.id,
              electiveBatchId: eb.id,
              sessionDate: dVal,
              timingCode: "T" + (i + 1),
              timingLabel: "09:00 - 10:00",
              timingStartTime: "09:00",
              timingEndTime: "10:00",
            },
          });
        }
        for (const sid of enrolled) {
          const present = Math.random() < presentRate;
          await db.attendanceRecord.upsert({
            where: {
              sessionId_studentId: { sessionId: sess.id, studentId: sid },
            },
            create: {
              id: crypto.randomUUID(),
              sessionId: sess.id,
              studentId: sid,
              status: present ? "PRESENT" : "ABSENT",
            },
            update: { status: present ? "PRESENT" : "ABSENT" },
          });
        }
      }
      return;
    }
  }
  const targets = assignments.filter((a) => a.sectionId);
  if (targets.length === 0) return;
  for (const a of targets) {
    if (WIPE_SESSIONS) {
      const toDel = await db.classSession.findMany({
        where: {
          courseId: course.id,
          sectionId: a.sectionId!,
          facultyId: faculty.id,
          sessionDate: { gte: start, lte: end },
        },
        select: { id: true },
      });
      if (toDel.length > 0) {
        await db.attendanceRecord.deleteMany({
          where: { sessionId: { in: toDel.map((x) => x.id) } },
        });
        await db.classSession.deleteMany({
          where: { id: { in: toDel.map((x) => x.id) } },
        });
      }
    }
    const dates: Date[] = [];
    const totalMs = end.getTime() - start.getTime();
    const step = totalMs / Math.max(1, sessionCount);
    for (let i = 0; i < sessionCount; i++) {
      const d = new Date(start.getTime() + i * step + step * 0.2);
      d.setHours(9, 0, 0, 0);
      dates.push(d);
    }
    let enrolled = studentIds;
    if (a.batchId) {
      const b = await db.batch.findUnique({
        where: { id: a.batchId },
        select: { students: { select: { id: true } } },
      });
      if (b)
        enrolled = b.students
          .map((x) => x.id)
          .filter((id) => studentIds.includes(id));
      if (enrolled.length === 0) enrolled = studentIds;
    } else {
      const sec = await db.studentSection.findMany({
        where: { sectionId: a.sectionId! },
        select: { studentId: true },
      });
      if (sec.length > 0)
        enrolled = sec
          .map((x) => x.studentId)
          .filter((id) => studentIds.includes(id));
      if (enrolled.length === 0) enrolled = studentIds;
    }
    for (let i = 0; i < dates.length; i++) {
      const dVal = dates[i]!;
      let sess = await db.classSession.findFirst({
        where: {
          courseId: course.id,
          sectionId: a.sectionId!,
          facultyId: faculty.id,
          sessionDate: dVal,
          timingCode: "T" + (i + 1),
        },
      });
      if (!sess) {
        sess = await db.classSession.create({
          data: {
            id: crypto.randomUUID(),
            courseId: course.id,
            sectionId: a.sectionId!,
            facultyId: faculty.id,
            batchId: a.batchId || null,
            sessionDate: dVal,
            timingCode: "T" + (i + 1),
            timingLabel: "09:00 - 10:00",
            timingStartTime: "09:00",
            timingEndTime: "10:00",
          },
        });
      }
      for (const sid of enrolled) {
        const present = Math.random() < presentRate;
        await db.attendanceRecord.upsert({
          where: {
            sessionId_studentId: { sessionId: sess.id, studentId: sid },
          },
          create: {
            id: crypto.randomUUID(),
            sessionId: sess.id,
            studentId: sid,
            status: present ? "PRESENT" : "ABSENT",
          },
          update: { status: present ? "PRESENT" : "ABSENT" },
        });
      }
    }
  }
}

interface RunStats {
  coursesScanned: number;
  coursesProcessed: number;
  skippedIncomplete: number;
  skippedFrozen: number;
  skippedUnowned: number;
  skippedEmptyRoster: number;
  assessmentsPopulated: number;
  studentsAssessed: number;
  attendanceCreated: number;
  attendanceUpdated: number;
  errors: number;
}

async function processOwnerCourse(
  course: TargetCourse,
  owner: OwnerRef,
  stats: RunStats
): Promise<void> {
  const roster = await resolveRoster(course, owner);
  if (roster.length === 0) {
    stats.skippedEmptyRoster++;
    console.warn(
      `[warn] ${course.code}: no registered students for ${
        owner.electiveBatchId ?? "assigned sections"
      }; skipping`
    );
    return;
  }

  const tiers = assignTiers(
    roster.map((r) => r.studentId),
    `${course.code}:${owner.key}`
  );
  const rng = rngFor(`${SEED}:${course.code}:${owner.key}:marks`);
  const passThresholdPct = course.cieEligibility;

  const slots = buildAssessmentSlots(course)
    .map((slot) => ({
      slot,
      assessment: findAssessmentForSlot(
        course.assessments,
        slot
      ) as AssessmentRef,
    }))
    .filter(({ assessment }) => assessment?.questions?.length > 0);

  // One batched registration resolve per owner-course (was per save call).
  const registrationByStudent = DRY_RUN
    ? new Map<string, { id: string }>()
    : await resolveActiveRegistrationsForCourse({
        courseId: course.id,
        studentIds: roster.map((r) => r.studentId),
        semesterId: course.semesterId,
      });

  for (const { assessment } of slots) {
    const marks: Array<{
      studentId: string;
      questionId: string;
      marksObtained: number;
    }> = [];
    const studentTotals: StudentTotalEntry[] = [];

    for (const [studentId, tier] of tiers) {
      const fraction = tierMarkFraction(tier, rng, passThresholdPct);
      const totalMarks = Math.round(assessment.totalMarks * fraction);
      studentTotals.push({ studentId, totalMarks, status: "PRESENT" });
      if (!DRY_RUN) {
        const splits = splitAcrossQuestions(
          totalMarks,
          assessment.questions,
          rng
        );
        marks.push(...splits.map((split) => ({ ...split, studentId })));
      }
    }

    console.log(
      `${DRY_RUN ? "[dry-run] " : ""}${course.code}: "${assessment.title}" → ${studentTotals.length} students`
    );

    if (DRY_RUN) {
      stats.assessmentsPopulated++;
      stats.studentsAssessed += studentTotals.length;
      continue;
    }

    try {
      await saveAssessmentBatch(
        course,
        assessment,
        studentTotals,
        marks,
        registrationByStudent,
        stats
      );
    } catch (error) {
      stats.errors++;
      console.error(
        `[error] ${course.code}: failed to save marks for "${assessment.title}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  if (!DRY_RUN) {
    try {
      await syncAttendanceBatch(
        course,
        owner,
        [...tiers],
        rng,
        registrationByStudent,
        stats
      );
      const studentIds = [...tiers].map(([sid]) => sid);
      await syncSessionsBatch(
        course,
        owner,
        studentIds,
        PRESENT_RATE,
        SESSIONS_PER_COURSE
      );
    } catch (error) {
      stats.errors++;
      console.error(
        `[error] ${course.code}: attendance batch failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

async function populate(): Promise<void> {
  const courses = await fetchTargetCourses();
  const stats: RunStats = {
    coursesScanned: courses.length,
    coursesProcessed: 0,
    skippedIncomplete: 0,
    skippedFrozen: 0,
    skippedUnowned: 0,
    skippedEmptyRoster: 0,
    assessmentsPopulated: 0,
    studentsAssessed: 0,
    attendanceCreated: 0,
    attendanceUpdated: 0,
    errors: 0,
  };

  let index = 0;
  for (const course of courses) {
    index++;
    console.log(`[progress] course ${index}/${courses.length}: ${course.code}`);
    if (!isQpComplete(course)) {
      stats.skippedIncomplete++;
      console.warn(`[warn] ${course.code}: QP setup incomplete; skipping`);
      continue;
    }
    if (course.frozen) {
      stats.skippedFrozen++;
      console.warn(`[warn] ${course.code}: marks/attendance frozen; skipping`);
      continue;
    }
    if (course.owners.length === 0) {
      stats.skippedUnowned++;
      console.warn(`[warn] ${course.code}: no assigned faculty; skipping`);
      continue;
    }

    stats.coursesProcessed++;
    for (const owner of course.owners) {
      await processOwnerCourse(course, owner, stats);
    }

    // One batched recompute per course — replaces ~6S queries per assessment
    // (recomputeStudentMark inside saveAssessmentMarks) with ~3 + 2S here.
    if (!DRY_RUN) {
      await recomputeCourseMarks(course.id);
    }
  }

  console.log("\n========================================");
  console.log(DRY_RUN ? "Population preview (dry-run)" : "Population complete");
  console.log("========================================");
  console.log(`Courses scanned         : ${stats.coursesScanned}`);
  console.log(`Courses processed       : ${stats.coursesProcessed}`);
  console.log(`Skipped (incomplete QP) : ${stats.skippedIncomplete}`);
  console.log(`Skipped (frozen)        : ${stats.skippedFrozen}`);
  console.log(`Skipped (no faculty)    : ${stats.skippedUnowned}`);
  console.log(`Skipped (empty roster)  : ${stats.skippedEmptyRoster}`);
  console.log(`Assessments populated   : ${stats.assessmentsPopulated}`);
  console.log(`Student assessments     : ${stats.studentsAssessed}`);
  console.log(`Attendance created      : ${stats.attendanceCreated}`);
  console.log(`Attendance updated      : ${stats.attendanceUpdated}`);
  console.log(`Errors                  : ${stats.errors}`);
  console.log("========================================\n");

  if (stats.errors > 0) {
    throw new Error(`${stats.errors} write(s) failed during population`);
  }
}

interface VerifyAnomaly {
  detail: string;
}

async function runVerificationGate(): Promise<boolean> {
  const anomalies: VerifyAnomaly[] = [];
  const courses = (await fetchTargetCourses()).filter(isQpComplete);

  for (const course of courses) {
    const marks = await db.mark.findMany({
      where: { courseId: course.id },
      select: { studentId: true, cieTotal: true, status: true },
    });
    if (marks.length === 0) {
      anomalies.push({ detail: `${course.code}: no Mark rows found` });
      continue;
    }
    const threshold = (course.cieEligibility / 100) * course.cieMaxMarks;
    for (const mark of marks) {
      if (mark.cieTotal === null) {
        anomalies.push({ detail: `${course.code}: student has null cieTotal` });
        continue;
      }
      const shouldBeEligible = mark.cieTotal >= threshold;
      if (shouldBeEligible && mark.status !== "ELIGIBLE") {
        anomalies.push({
          detail: `${course.code}: cieTotal=${mark.cieTotal} >= ${threshold.toFixed(1)} but status=${mark.status}`,
        });
      }
      if (!shouldBeEligible && mark.status !== "NOT_ELIGIBLE") {
        anomalies.push({
          detail: `${course.code}: cieTotal=${mark.cieTotal} < ${threshold.toFixed(1)} but status=${mark.status}`,
        });
      }
    }

    const eligible = marks.filter((m) => m.status === "ELIGIBLE").length;
    const notEligible = marks.filter((m) => m.status === "NOT_ELIGIBLE").length;
    console.log(
      `${course.code}: ${marks.length} students — ${eligible} ELIGIBLE / ${notEligible} NOT_ELIGIBLE`
    );

    const attendanceRows = await db.attendance.findMany({
      where: { courseId: course.id },
      select: { percentage: true },
    });
    const missing = marks.length - attendanceRows.length;
    if (missing > 0) {
      anomalies.push({
        detail: `${course.code}: ${missing} students missing attendance`,
      });
    }
    const bands = {
      failing: 0,
      warning: 0,
      healthy: 0,
    };
    for (const row of attendanceRows) {
      if (row.percentage < 75) bands.failing++;
      else if (row.percentage < 85) bands.warning++;
      else bands.healthy++;
    }
    console.log(
      `  attendance: ${attendanceRows.length} rows — <75%: ${bands.failing}, 75-84%: ${bands.warning}, >=85%: ${bands.healthy}`
    );
  }

  console.log("\n========================================");
  console.log("Marks & attendance verification");
  console.log("========================================");
  console.log(`QP-complete courses checked : ${courses.length}`);
  console.log(`Anomalies                   : ${anomalies.length}`);
  for (const anomaly of anomalies.slice(0, 50)) {
    console.log(`  ${anomaly.detail}`);
  }
  const passed = anomalies.length === 0;
  console.log(`\nGate: ${passed ? "PASS" : "FAIL"}`);
  console.log("========================================\n");
  return passed;
}

async function main(): Promise<void> {
  console.log(`Seed: ${SEED}${DRY_RUN ? " (dry-run)" : ""}`);

  if (VERIFY_ONLY) {
    const passed = await runVerificationGate();
    process.exit(passed ? 0 : 1);
  }

  await populate();

  if (!DRY_RUN) {
    const passed = await runVerificationGate();
    if (!passed) {
      console.error("Verification failed after population.");
      process.exit(1);
    }
  }
}

if (import.meta.main) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
