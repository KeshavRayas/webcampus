import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import {
  isPeFull,
  peCourseCapacity,
} from "../src/services/shared/pe-capacity.service";
import { strategyFor } from "../src/services/student/registration-strategies";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load root .env when script is invoked without `bun --env-file=../../.env`
// (Prisma validates DATABASE_URL at client construction, so must run before `db` import)
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: resolve(__dirname, "../../../.env") });
}
if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL missing — run via: bun --env-file=../../.env run tsx scripts/backfill-course-registration.ts --dry-run"
  );
}
const { db } = await import("@webcampus/db");

const DRY_RUN = process.argv.includes("--dry-run");

// --em on|off (default on). "on" also writes ElectiveStudentAssignment (and any
// missing ElectiveBatchFaculty) for PE; OE always maps a batch regardless.
function parseFlag(name: string): string | undefined {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(`--${name}=`.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1) {
    const value = process.argv[index + 1];
    if (value && !value.startsWith("--")) return value;
  }
  return undefined;
}
const ELECTIVE_MAPPING = (parseFlag("em") ?? "on").toLowerCase() === "on";
const REPAIR_MAPPING = process.argv.includes("--repair-mapping");

// ── Deterministic seeded RNG helpers ─────────────────────────────
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}

// Assigns PE/OE students who have a CourseRegistration but no
// ElectiveStudentAssignment to a batch with remaining capacity,
// auto-creating an ElectiveBatchFaculty mapping if the batch lacks one.
// Idempotent: already-assigned students are skipped.
async function repairElectiveMapping() {
  const startTime = Date.now();
  const stats = {
    peCourses: 0,
    oeCourses: 0,
    pending: 0,
    repaired: 0,
    skippedNoBatch: 0,
    skippedNoFaculty: 0,
    duplicateSuppressed: 0,
    facultyMappings: 0,
    versionBumps: 0,
    errors: 0,
  };

  const courses = await db.course.findMany({
    where: { courseType: { in: ["PE", "OE"] }, approvalStatus: "APPROVED" },
    select: {
      id: true,
      code: true,
      name: true,
      courseType: true,
      departmentName: true,
      studentsPerBatch: true,
      semester: {
        select: {
          semesterNumber: true,
          academicTerm: { select: { year: true } },
        },
      },
      electiveBatches: {
        select: {
          id: true,
          name: true,
          sortOrder: true,
          facultyAssignment: {
            select: { facultyId: true, semester: true, academicYear: true },
          },
        },
      },
    },
    orderBy: { code: "asc" },
  });

  stats.peCourses = courses.filter((c) => c.courseType === "PE").length;
  stats.oeCourses = courses.filter((c) => c.courseType === "OE").length;

  if (courses.length === 0) {
    console.log("No PE/OE courses found to repair.");
    return;
  }

  type RepairCourse = (typeof courses)[number];
  const courseIds = courses.map((c) => c.id);
  const courseById = new Map(courses.map((c) => [c.id, c]));

  const [regs, existingAssignments] = await Promise.all([
    db.courseRegistration.findMany({
      where: { courseId: { in: courseIds } },
      include: { academicTerm: { select: { year: true } } },
    }),
    db.electiveStudentAssignment.findMany({
      where: { courseId: { in: courseIds } },
      select: { studentId: true, courseId: true },
    }),
  ]);

  const existingKey = new Set(
    existingAssignments.map((a) => `${a.studentId}::${a.courseId}`)
  );

  const batchAssignmentCount = new Map<string, number>();
  const batchRows = await db.electiveStudentAssignment.groupBy({
    by: ["electiveBatchId"],
    where: { courseId: { in: courseIds } },
    _count: { _all: true },
  });
  for (const row of batchRows) {
    batchAssignmentCount.set(row.electiveBatchId, row._count._all);
  }

  const academicYearByCourse = new Map<string, string>();
  for (const reg of regs) {
    if (!academicYearByCourse.has(reg.courseId)) {
      academicYearByCourse.set(reg.courseId, reg.academicTerm?.year ?? "");
    }
  }

  const faculties = await db.faculty.findMany({
    select: { id: true, department: { select: { name: true } } },
  });
  const facultyByDepartment = new Map<string, string[]>();
  for (const faculty of faculties) {
    const deptName = faculty.department?.name;
    if (!deptName) continue;
    const list = facultyByDepartment.get(deptName) ?? [];
    list.push(faculty.id);
    facultyByDepartment.set(deptName, list);
  }
  const allFacultyIds = faculties.map((f) => f.id);

  const facultyChosenByBatch = new Map<string, string>();
  const facultyRowByBatch = new Map<
    string,
    {
      courseId: string;
      electiveBatchId: string;
      facultyId: string;
      semester: number;
      academicYear: string;
    }
  >();
  const executedFacultyBatches = new Set<string>();

  const resolveFacultyForBatch = (
    batch: RepairCourse["electiveBatches"][number],
    course: RepairCourse,
    academicYear: string
  ): string | null => {
    if (batch.facultyAssignment) return batch.facultyAssignment.facultyId;
    const chosen = facultyChosenByBatch.get(batch.id);
    if (chosen) return chosen;
    let pool = course.departmentName
      ? (facultyByDepartment.get(course.departmentName) ?? [])
      : [];
    if (pool.length === 0) pool = allFacultyIds;
    if (pool.length === 0) return null;
    const facultyId = shuffle(
      pool,
      mulberry32(hashString(`${course.id}::${batch.id}::faculty`))
    )[0]!;
    facultyChosenByBatch.set(batch.id, facultyId);
    facultyRowByBatch.set(batch.id, {
      courseId: course.id,
      electiveBatchId: batch.id,
      facultyId,
      semester: course.semester.semesterNumber,
      academicYear,
    });
    return facultyId;
  };

  type RepairItem = {
    studentId: string;
    courseId: string;
    courseType: "PE" | "OE";
    electiveBatchId: string;
  };
  const repairItems: RepairItem[] = [];

  for (const reg of regs) {
    const key = `${reg.studentId}::${reg.courseId}`;
    if (existingKey.has(key)) continue;
    const course = courseById.get(reg.courseId);
    if (!course) continue;
    const perBatch = course.studentsPerBatch ?? 0;
    const openBatches = course.electiveBatches.filter(
      (b) => (batchAssignmentCount.get(b.id) ?? 0) < perBatch
    );
    if (openBatches.length === 0) {
      stats.skippedNoBatch += 1;
      continue;
    }
    const batch = shuffle(
      openBatches,
      mulberry32(hashString(`${reg.studentId}::${course.id}`))
    )[0]!;
    const academicYear = academicYearByCourse.get(course.id) ?? "";
    if (!resolveFacultyForBatch(batch, course, academicYear)) {
      stats.skippedNoFaculty += 1;
      continue;
    }
    repairItems.push({
      studentId: reg.studentId,
      courseId: course.id,
      courseType: course.courseType as "PE" | "OE",
      electiveBatchId: batch.id,
    });
    batchAssignmentCount.set(
      batch.id,
      (batchAssignmentCount.get(batch.id) ?? 0) + 1
    );
  }

  stats.pending = repairItems.length;

  const printRepairSummary = (created: boolean) => {
    console.log(`\n========================================`);
    console.log(`Elective Mapping Repair (--repair-mapping)`);
    console.log(`========================================`);
    console.log(`PE courses checked       : ${stats.peCourses}`);
    console.log(`OE courses checked       : ${stats.oeCourses}`);
    console.log(`Registrations scanned    : ${regs.length}`);
    console.log(`Already assigned         : ${existingKey.size}`);
    if (created) {
      console.log(`----------------------------------------`);
      console.log(`Assignments created      : ${stats.repaired}`);
      console.log(`Faculty mappings created : ${stats.facultyMappings}`);
      console.log(`Mapping version bumps    : ${stats.versionBumps}`);
      console.log(`Duplicates suppressed    : ${stats.duplicateSuppressed}`);
    }
    console.log(`----------------------------------------`);
    console.log(`Pending assignments      : ${stats.pending}`);
    console.log(`  skipped (no batch)     : ${stats.skippedNoBatch}`);
    console.log(`  skipped (no faculty)   : ${stats.skippedNoFaculty}`);
    if (DRY_RUN && repairItems.length > 0) {
      console.log(`----------------------------------------`);
      console.log(`Sample repairs (up to 5):`);
      for (const item of repairItems.slice(0, 5)) {
        const course = courseById.get(item.courseId);
        const code = course?.code ?? "?";
        const batch = course?.electiveBatches.find(
          (b) => b.id === item.electiveBatchId
        );
        console.log(
          `  - ${item.studentId} -> ${code} (${item.courseType}) batch: ${batch?.name ?? item.electiveBatchId}`
        );
      }
    }
    console.log(`Errors                  : ${stats.errors}`);
    console.log(`----------------------------------------`);
    console.log(
      `Elapsed                 : ${((Date.now() - startTime) / 1000).toFixed(1)}s${DRY_RUN ? " (dry-run)" : ""}`
    );
    console.log(`========================================\n`);
  };

  if (DRY_RUN) {
    printRepairSummary(false);
    return;
  }

  const BATCH_SIZE = 100;
  for (let i = 0; i < repairItems.length; i += BATCH_SIZE) {
    const batch = repairItems.slice(i, i + BATCH_SIZE);
    try {
      await db.$transaction(async (tx) => {
        const courseIdsInBatch = [...new Set(batch.map((c) => c.courseId))];
        for (const courseId of courseIdsInBatch) {
          const rows = batch
            .filter((c) => c.courseId === courseId)
            .map((c) => ({
              courseId: c.courseId,
              studentId: c.studentId,
              electiveBatchId: c.electiveBatchId,
            }));
          const result = await tx.electiveStudentAssignment.createMany({
            data: rows,
            skipDuplicates: true,
          });
          stats.repaired += result.count;
          if (result.count > 0) {
            await tx.course.update({
              where: { id: courseId },
              data: { electiveMappingVersion: { increment: 1 } },
            });
            stats.versionBumps += 1;
          }
          if (result.count < rows.length) {
            stats.duplicateSuppressed += rows.length - result.count;
          }
        }
        const newFacultyBatchIds = [
          ...new Set(
            batch
              .filter((c) => facultyRowByBatch.has(c.electiveBatchId))
              .map((c) => c.electiveBatchId)
          ),
        ].filter((bid) => !executedFacultyBatches.has(bid));
        const facultyRows = newFacultyBatchIds
          .map((bid) => facultyRowByBatch.get(bid))
          .filter((row): row is NonNullable<typeof row> => Boolean(row));
        if (facultyRows.length > 0) {
          const facultyResult = await tx.electiveBatchFaculty.createMany({
            data: facultyRows.map((row) => ({
              courseId: row.courseId,
              electiveBatchId: row.electiveBatchId,
              facultyId: row.facultyId,
              semester: row.semester,
              academicYear: row.academicYear,
            })),
            skipDuplicates: true,
          });
          stats.facultyMappings += facultyResult.count;
          for (const bid of newFacultyBatchIds) {
            executedFacultyBatches.add(bid);
          }
        }
      });
    } catch (error) {
      stats.errors += 1;
      console.error(
        `Repair batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
        error
      );
    }
  }

  printRepairSummary(true);
  if (stats.errors > 0) {
    throw new Error(`${stats.errors} repair batch(es) failed`);
  }
}

async function main() {
  const startTime = Date.now();

  if (REPAIR_MAPPING) {
    await repairElectiveMapping();
    return;
  }

  // ── Query 1: All StudentSection records ──────────────────────────
  const studentSections = await db.studentSection.findMany({
    include: {
      student: {
        select: { departmentId: true, departmentName: true, programType: true },
      },
      section: {
        select: {
          semesterId: true,
          cycle: true,
          semester: {
            select: { academicTermId: true },
          },
        },
      },
    },
  });
  const scannedCount = studentSections.length;

  // ── Build section lookup ─────────────────────────────────────────
  const sectionData = new Map(
    studentSections.map((ss) => [
      ss.sectionId,
      {
        semesterId: ss.section.semesterId,
        academicTermId: ss.section.semester.academicTermId,
        cycle: ss.section.cycle,
      },
    ])
  );

  // ── Group studentSections by (sectionId, semester, academicYear) ─
  const groupKey = (ss: (typeof studentSections)[number]) =>
    `${ss.sectionId}::${ss.semester}::${ss.academicYear}`;
  const sectionGroups = groupBy(studentSections, groupKey);
  const groupCount = sectionGroups.size;

  // ── Query 2: CourseAssignment for all unique section combos ──────
  const uniqueKeys = [...sectionGroups.keys()].map((key) => {
    const [sectionId, semesterStr, academicYear] = key.split("::");
    return { sectionId, semester: Number(semesterStr), academicYear };
  });

  const courseAssignments =
    uniqueKeys.length > 0
      ? await db.courseAssignment.findMany({
          where: {
            OR: uniqueKeys.map((k) => ({
              sectionId: k.sectionId,
              semester: k.semester,
              academicYear: k.academicYear,
            })),
          },
          select: {
            sectionId: true,
            semester: true,
            academicYear: true,
            courseId: true,
          },
        })
      : [];
  const courseAssignmentCount = courseAssignments.length;

  // ── Build course lookup per group key ────────────────────────────
  const coursesByGroup = new Map<string, Set<string>>();
  for (const ca of courseAssignments) {
    const key = `${ca.sectionId}::${ca.semester}::${ca.academicYear}`;
    const set = coursesByGroup.get(key) ?? new Set();
    set.add(ca.courseId);
    coursesByGroup.set(key, set);
  }

  // ── Build candidate registration pairs ───────────────────────────
  const candidateMap = new Map<
    string,
    {
      studentId: string;
      courseId: string;
      semesterId: string;
      academicTermId: string;
    }
  >();

  for (const [key, group] of sectionGroups) {
    const courseIds = coursesByGroup.get(key);
    if (!courseIds || courseIds.size === 0) continue;

    const sectionInfo = sectionData.get(group[0]!.sectionId);
    if (!sectionInfo) continue;

    const { semesterId, academicTermId } = sectionInfo;

    for (const ss of group) {
      for (const courseId of courseIds) {
        candidateMap.set(`${ss.studentId}::${courseId}`, {
          studentId: ss.studentId,
          courseId,
          semesterId,
          academicTermId,
        });
      }
    }
  }
  const candidateCount = candidateMap.size;

  // ── Find existing registrations to exclude ───────────────────────
  let alreadyExistingCount = 0;
  let createdCount = 0;
  let errorCount = 0;

  if (candidateCount > 0) {
    const allStudentIds = [
      ...new Set([...candidateMap.values()].map((c) => c.studentId)),
    ];
    const allCourseIds = [
      ...new Set([...candidateMap.values()].map((c) => c.courseId)),
    ];

    const existingRegs = await db.courseRegistration.findMany({
      where: {
        studentId: { in: allStudentIds },
        courseId: { in: allCourseIds },
      },
      select: { studentId: true, courseId: true },
    });

    const existingSet = new Set(
      existingRegs.map((r) => `${r.studentId}::${r.courseId}`)
    );
    alreadyExistingCount = existingRegs.length;

    // ── Remove already-existing from candidates ────────────────────
    for (const key of candidateMap.keys()) {
      if (existingSet.has(key)) {
        candidateMap.delete(key);
      }
    }
  }

  const toCreate = [...candidateMap.values()];
  const toCreateCount = toCreate.length;

  // ══ PE / OE / PW registration phase ══════════════════════════════
  const semesterIdsInScope = [
    ...new Set(studentSections.map((ss) => ss.section.semesterId)),
  ];
  const allSectionStudentIds = [
    ...new Set(studentSections.map((ss) => ss.studentId)),
  ];

  const electiveCourses =
    semesterIdsInScope.length > 0
      ? await db.course.findMany({
          where: {
            courseType: { in: ["PE", "OE", "PW"] },
            semesterId: { in: semesterIdsInScope },
            approvalStatus: "APPROVED",
          },
          select: {
            id: true,
            code: true,
            name: true,
            courseType: true,
            departmentName: true,
            cycle: true,
            numberOfBatches: true,
            studentsPerBatch: true,
            openElectiveEligibility: true,
            semesterId: true,
            department: {
              select: { id: true, name: true },
            },
            semester: {
              select: { academicTermId: true, semesterNumber: true },
            },
            electiveBatches: {
              select: {
                id: true,
                name: true,
                sortOrder: true,
                facultyAssignment: {
                  select: {
                    facultyId: true,
                    semester: true,
                    academicYear: true,
                  },
                },
              },
            },
            openElectiveDepartments: {
              select: { department: { select: { id: true, name: true } } },
            },
          },
          orderBy: { code: "asc" },
        })
      : [];

  type ElectiveCourse = (typeof electiveCourses)[number];
  type ElectiveBatchRow =
    (typeof electiveCourses)[number]["electiveBatches"][number];

  const peCourses = electiveCourses.filter((c) => c.courseType === "PE");
  const oeCourses = electiveCourses.filter((c) => c.courseType === "OE");
  const pwCourses = electiveCourses.filter((c) => c.courseType === "PW");
  const electiveCourseIds = electiveCourses.map((c) => c.id);
  const electiveCourseById = new Map(electiveCourses.map((c) => [c.id, c]));

  // ── Occupancy maps (DB baseline + pending from this run) ─────────
  const courseRegistrationCount = new Map<string, number>();
  const batchAssignmentCount = new Map<string, number>();

  if (electiveCourseIds.length > 0) {
    const regCounts = await db.courseRegistration.groupBy({
      by: ["courseId"],
      where: { courseId: { in: electiveCourseIds } },
      _count: { _all: true },
    });
    for (const row of regCounts) {
      courseRegistrationCount.set(row.courseId, row._count._all);
    }

    const assignCounts = await db.electiveStudentAssignment.groupBy({
      by: ["electiveBatchId"],
      where: { courseId: { in: electiveCourseIds } },
      _count: { _all: true },
    });
    for (const row of assignCounts) {
      batchAssignmentCount.set(row.electiveBatchId, row._count._all);
    }
  }

  // ── Existing elective registrations to exclude ───────────────────
  const existingPeForStudent = new Set<string>();
  const existingOeForStudent = new Set<string>();
  const existingPwForStudent = new Set<string>();

  if (electiveCourseIds.length > 0) {
    const existingRegs = await db.courseRegistration.findMany({
      where: {
        studentId: { in: allSectionStudentIds },
        courseId: { in: electiveCourseIds },
      },
      select: { studentId: true, courseId: true },
    });

    for (const reg of existingRegs) {
      const course = electiveCourseById.get(reg.courseId);
      if (!course) continue;
      const semKey = `${reg.studentId}::${course.semesterId}`;
      if (course.courseType === "PE") existingPeForStudent.add(semKey);
      else if (course.courseType === "OE") existingOeForStudent.add(semKey);
      else if (course.courseType === "PW") {
        existingPwForStudent.add(`${reg.studentId}::${reg.courseId}`);
      }
    }
  }

  // ── Faculty pool for auto-assignment ─────────────────────────────
  const faculties = await db.faculty.findMany({
    select: { id: true, department: { select: { name: true } } },
  });
  const facultyByDepartment = new Map<string, string[]>();
  for (const faculty of faculties) {
    const deptName = faculty.department?.name;
    if (!deptName) continue;
    const list = facultyByDepartment.get(deptName) ?? [];
    list.push(faculty.id);
    facultyByDepartment.set(deptName, list);
  }
  const allFacultyIds = faculties.map((f) => f.id);

  const electiveStats = {
    peCourses: peCourses.length,
    oeCourses: oeCourses.length,
    pwCourses: pwCourses.length,
    peRegistered: 0,
    oeRegistered: 0,
    pwRegistered: 0,
    peSkippedAlready: 0,
    peSkippedFull: 0,
    peSkippedNoFaculty: 0,
    oeSkippedAlready: 0,
    oeSkippedFull: 0,
    oeSkippedNoFaculty: 0,
    pwSkippedAlready: 0,
    batchMappings: 0,
    facultyMappings: 0,
    versionBumps: 0,
    createdRegistrations: 0,
    createdAssignments: 0,
    createdFaculty: 0,
    duplicateSuppressed: 0,
  };

  const facultyChosenByBatch = new Map<string, string>();
  const facultyRowByBatch = new Map<
    string,
    {
      courseId: string;
      electiveBatchId: string;
      facultyId: string;
      semester: number;
      academicYear: string;
    }
  >();
  const executedFacultyBatches = new Set<string>();

  const resolveFacultyForBatch = (
    batch: ElectiveBatchRow,
    course: ElectiveCourse,
    academicYear: string
  ): string | null => {
    if (batch.facultyAssignment) return batch.facultyAssignment.facultyId;
    const chosen = facultyChosenByBatch.get(batch.id);
    if (chosen) return chosen;
    let pool = course.departmentName
      ? (facultyByDepartment.get(course.departmentName) ?? [])
      : [];
    if (pool.length === 0) pool = allFacultyIds;
    if (pool.length === 0) return null;
    const facultyId = shuffle(
      pool,
      mulberry32(hashString(`${course.id}::${batch.id}::faculty`))
    )[0]!;
    facultyChosenByBatch.set(batch.id, facultyId);
    facultyRowByBatch.set(batch.id, {
      courseId: course.id,
      electiveBatchId: batch.id,
      facultyId,
      semester: course.semester.semesterNumber,
      academicYear,
    });
    return facultyId;
  };

  type ElectiveCandidate = {
    studentId: string;
    courseId: string;
    semesterId: string;
    academicTermId: string;
    courseType: "PE" | "OE" | "PW";
    electiveBatchId?: string;
    academicYear: string;
  };

  const electiveCandidates: ElectiveCandidate[] = [];
  const processedStudentSemester = new Set<string>();

  const pickPeCourse = (
    eligible: ElectiveCourse[],
    studentId: string,
    semesterId: string
  ): {
    course: ElectiveCourse;
    batch: ElectiveBatchRow | undefined;
  } | null => {
    const rng = mulberry32(hashString(`${studentId}::${semesterId}::PE`));
    for (const course of shuffle(eligible, rng)) {
      const capacity = peCourseCapacity(
        course.numberOfBatches,
        course.studentsPerBatch
      );
      const registered = courseRegistrationCount.get(course.id) ?? 0;
      if (isPeFull(capacity, registered)) continue;
      if (ELECTIVE_MAPPING) {
        const perBatch = course.studentsPerBatch ?? 0;
        const openBatches = course.electiveBatches.filter(
          (b) => (batchAssignmentCount.get(b.id) ?? 0) < perBatch
        );
        if (openBatches.length === 0) continue;
        const batch = shuffle(
          openBatches,
          mulberry32(hashString(`${studentId}::${course.id}`))
        )[0]!;
        return { course, batch };
      }
      return { course, batch: undefined };
    }
    return null;
  };

  const pickOeCourse = (
    visible: ElectiveCourse[],
    studentId: string
  ): {
    course: ElectiveCourse;
    batch: ElectiveBatchRow;
  } | null => {
    const rng = mulberry32(hashString(`${studentId}::OE`));
    for (const course of shuffle(visible, rng)) {
      const perBatch = course.studentsPerBatch ?? 0;
      const openBatches = course.electiveBatches.filter(
        (b) => (batchAssignmentCount.get(b.id) ?? 0) < perBatch
      );
      if (openBatches.length === 0) continue;
      const batch = shuffle(
        openBatches,
        mulberry32(hashString(`${studentId}::${course.id}`))
      )[0]!;
      return { course, batch };
    }
    return null;
  };

  const queueCandidate = (
    studentId: string,
    course: ElectiveCourse,
    batch: ElectiveBatchRow | undefined,
    semesterId: string,
    academicTermId: string,
    academicYear: string
  ) => {
    electiveCandidates.push({
      studentId,
      courseId: course.id,
      semesterId,
      academicTermId,
      courseType: course.courseType as "PE" | "OE" | "PW",
      electiveBatchId: batch?.id,
      academicYear,
    });
    courseRegistrationCount.set(
      course.id,
      (courseRegistrationCount.get(course.id) ?? 0) + 1
    );
    if (batch) {
      batchAssignmentCount.set(
        batch.id,
        (batchAssignmentCount.get(batch.id) ?? 0) + 1
      );
    }
  };

  // ── Build PE / OE / PW candidates ───────────────────────────────
  for (const [, group] of sectionGroups) {
    const sectionInfo = sectionData.get(group[0]!.sectionId);
    if (!sectionInfo) continue;
    const { semesterId, academicTermId, cycle: sectionCycle } = sectionInfo;
    const groupAcademicYear = group[0]!.academicYear;

    for (const ss of group) {
      const studentId = ss.studentId;
      const studentDepartmentId = ss.student.departmentId;
      const studentDepartmentName = ss.student.departmentName;
      const semKey = `${studentId}::${semesterId}`;
      if (processedStudentSemester.has(semKey)) continue;
      processedStudentSemester.add(semKey);

      // PE bucket (one per student per semester instance)
      if (existingPeForStudent.has(semKey)) {
        electiveStats.peSkippedAlready += 1;
      } else {
        const peEligible = peCourses.filter((course) => {
          if (course.semesterId !== semesterId) return false;
          if (course.cycle !== "NONE") {
            return (
              sectionCycle != null &&
              sectionCycle !== "NONE" &&
              sectionCycle === course.cycle
            );
          }
          return course.departmentName === studentDepartmentName;
        });
        const pePick = pickPeCourse(peEligible, studentId, semesterId);
        if (pePick) {
          if (
            pePick.batch &&
            !resolveFacultyForBatch(
              pePick.batch,
              pePick.course,
              groupAcademicYear
            )
          ) {
            electiveStats.peSkippedNoFaculty += 1;
          } else {
            queueCandidate(
              studentId,
              pePick.course,
              pePick.batch,
              semesterId,
              academicTermId,
              groupAcademicYear
            );
          }
        } else if (peEligible.length > 0) {
          electiveStats.peSkippedFull += 1;
        }
      }

      // OE bucket (one per student per semester instance)
      if (existingOeForStudent.has(semKey)) {
        electiveStats.oeSkippedAlready += 1;
      } else {
        const oeVisible = strategyFor("OE")
          .visibleCourses(oeCourses, studentDepartmentId, studentDepartmentName)
          .filter((course) => course.semesterId === semesterId);
        const oePick = pickOeCourse(oeVisible, studentId);
        if (oePick) {
          if (
            !resolveFacultyForBatch(
              oePick.batch,
              oePick.course,
              groupAcademicYear
            )
          ) {
            electiveStats.oeSkippedNoFaculty += 1;
          } else {
            queueCandidate(
              studentId,
              oePick.course,
              oePick.batch,
              semesterId,
              academicTermId,
              groupAcademicYear
            );
          }
        } else if (oeVisible.length > 0) {
          electiveStats.oeSkippedFull += 1;
        }
      }

      // PW courses are mandatory for every matching student. Registration is
      // intentionally independent of project-group and faculty mapping.
      const pwEligible = pwCourses.filter((course) => {
        if (course.semesterId !== semesterId) return false;
        const isFirstYearUg =
          ss.student.programType === "UG" &&
          [1, 2].includes(course.semester.semesterNumber);
        if (
          !isFirstYearUg &&
          course.department.name !== studentDepartmentName
        ) {
          return false;
        }
        return (
          course.cycle === "NONE" ||
          (sectionCycle != null &&
            sectionCycle !== "NONE" &&
            sectionCycle === course.cycle)
        );
      });

      for (const pwCourse of pwEligible) {
        const pwKey = `${studentId}::${pwCourse.id}`;
        if (existingPwForStudent.has(pwKey)) {
          electiveStats.pwSkippedAlready += 1;
          continue;
        }

        queueCandidate(
          studentId,
          pwCourse,
          undefined,
          semesterId,
          academicTermId,
          groupAcademicYear
        );
      }
    }
  }

  electiveStats.peRegistered = electiveCandidates.filter(
    (c) => c.courseType === "PE"
  ).length;
  electiveStats.oeRegistered = electiveCandidates.filter(
    (c) => c.courseType === "OE"
  ).length;
  electiveStats.pwRegistered = electiveCandidates.filter(
    (c) => c.courseType === "PW"
  ).length;
  electiveStats.facultyMappings = facultyRowByBatch.size;

  // ── Report summary before executing ──────────────────────────────
  const elapsedLabel = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

  const printElectiveSummary = (created: boolean) => {
    console.log(`----------------------------------------`);
    console.log(`PE courses eligible      : ${electiveStats.peCourses}`);
    console.log(`OE courses eligible      : ${electiveStats.oeCourses}`);
    console.log(`PW courses eligible      : ${electiveStats.pwCourses}`);
    console.log(
      `Elective mapping (--em)  : ${ELECTIVE_MAPPING ? "on" : "off"}`
    );
    console.log(`PE candidates            : ${electiveStats.peRegistered}`);
    console.log(`  skipped (already)      : ${electiveStats.peSkippedAlready}`);
    console.log(`  skipped (full)         : ${electiveStats.peSkippedFull}`);
    console.log(
      `  skipped (no faculty)   : ${electiveStats.peSkippedNoFaculty}`
    );
    console.log(`OE candidates            : ${electiveStats.oeRegistered}`);
    console.log(`  skipped (already)      : ${electiveStats.oeSkippedAlready}`);
    console.log(`  skipped (full)         : ${electiveStats.oeSkippedFull}`);
    console.log(
      `  skipped (no faculty)   : ${electiveStats.oeSkippedNoFaculty}`
    );
    console.log(`PW candidates            : ${electiveStats.pwRegistered}`);
    console.log(`  skipped (already)      : ${electiveStats.pwSkippedAlready}`);
    if (created) {
      console.log(
        `Registrations created    : ${electiveStats.createdRegistrations}`
      );
      console.log(
        `Batch assignments created: ${electiveStats.createdAssignments}`
      );
      console.log(`Faculty mappings created : ${electiveStats.createdFaculty}`);
      console.log(`Mapping version bumps    : ${electiveStats.versionBumps}`);
      console.log(
        `Duplicates suppressed    : ${electiveStats.duplicateSuppressed}`
      );
    }
  };

  if (DRY_RUN) {
    console.log(`\n========================================`);
    console.log(`Backfill Preview (dry-run)`);
    console.log(`========================================`);
    console.log(`StudentSections scanned : ${scannedCount}`);
    console.log(`Groups processed        : ${groupCount}`);
    console.log(`CourseAssignments found : ${courseAssignmentCount}`);
    console.log(`----------------------------------------`);
    console.log(`Registration candidates : ${candidateCount}`);
    console.log(`Already registered      : ${alreadyExistingCount}`);
    console.log(`Would create            : ${toCreateCount}`);
    printElectiveSummary(false);
    if (electiveCandidates.length > 0) {
      const batchNameById = new Map<string, string>(
        electiveCourses.flatMap((course) =>
          course.electiveBatches.map(
            (b) => [b.id, `${course.code} ${b.name}`] as const
          )
        )
      );
      console.log(`----------------------------------------`);
      console.log(`Sample elective assignments (up to 5):`);
      for (const candidate of electiveCandidates.slice(0, 5)) {
        const code = electiveCourseById.get(candidate.courseId)?.code ?? "?";
        const batchName = candidate.electiveBatchId
          ? (batchNameById.get(candidate.electiveBatchId) ??
            candidate.electiveBatchId)
          : "-";
        console.log(
          `  - ${candidate.studentId} -> ${code} (${candidate.courseType}) batch: ${batchName}`
        );
      }
    }
    console.log(`Errors                  : ${errorCount}`);
    console.log(`----------------------------------------`);
    console.log(`Elapsed                 : ${elapsedLabel} (dry-run)`);
    console.log(`========================================\n`);
    return;
  }

  // ── Execute: batch create with transaction per batch ─────────────
  const BATCH_SIZE = 100;
  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = toCreate.slice(i, i + BATCH_SIZE);
    try {
      await db.$transaction(async (tx) => {
        const result = await tx.courseRegistration.createMany({
          data: batch.map((c) => ({
            studentId: c.studentId,
            courseId: c.courseId,
            semesterId: c.semesterId,
            academicTermId: c.academicTermId,
          })),
          skipDuplicates: true,
        });
        createdCount += result.count;
      });
    } catch (error) {
      errorCount += 1;
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error);
    }
  }

  // ── Execute PE / OE / PW registrations ───────────────────────────
  for (let i = 0; i < electiveCandidates.length; i += BATCH_SIZE) {
    const batch = electiveCandidates.slice(i, i + BATCH_SIZE);
    try {
      await db.$transaction(async (tx) => {
        const courseIdsInBatch = [...new Set(batch.map((c) => c.courseId))];

        for (const courseId of courseIdsInBatch) {
          const regRows = batch.filter((c) => c.courseId === courseId);
          const regResult = await tx.courseRegistration.createMany({
            data: regRows.map((c) => ({
              studentId: c.studentId,
              courseId: c.courseId,
              semesterId: c.semesterId,
              academicTermId: c.academicTermId,
            })),
            skipDuplicates: true,
          });
          electiveStats.createdRegistrations += regResult.count;
          if (regResult.count > 0) {
            await tx.course.update({
              where: { id: courseId },
              data: { electiveMappingVersion: { increment: 1 } },
            });
            electiveStats.versionBumps += 1;
          }
          if (regResult.count < regRows.length) {
            electiveStats.duplicateSuppressed +=
              regRows.length - regResult.count;
          }

          // OE always maps a batch; PE maps one only when --em is on.
          const assignments = regRows
            .filter(
              (c) =>
                (c.courseType === "OE" || ELECTIVE_MAPPING) && c.electiveBatchId
            )
            .map((c) => ({
              courseId: c.courseId,
              studentId: c.studentId,
              electiveBatchId: c.electiveBatchId!,
            }));
          if (assignments.length > 0) {
            const assignResult = await tx.electiveStudentAssignment.createMany({
              data: assignments,
              skipDuplicates: true,
            });
            electiveStats.createdAssignments += assignResult.count;
            electiveStats.batchMappings += assignResult.count;
          }
        }

        // Create any newly auto-mapped faculty rows for this slice
        const newFacultyBatchIds = [
          ...new Set(
            batch
              .filter(
                (c) =>
                  c.electiveBatchId && facultyRowByBatch.has(c.electiveBatchId!)
              )
              .map((c) => c.electiveBatchId!)
          ),
        ].filter((bid) => !executedFacultyBatches.has(bid));
        const facultyRows = newFacultyBatchIds
          .map((bid) => facultyRowByBatch.get(bid))
          .filter((row): row is NonNullable<typeof row> => Boolean(row));
        if (facultyRows.length > 0) {
          const facultyResult = await tx.electiveBatchFaculty.createMany({
            data: facultyRows.map((row) => ({
              courseId: row.courseId,
              electiveBatchId: row.electiveBatchId,
              facultyId: row.facultyId,
              semester: row.semester,
              academicYear: row.academicYear,
            })),
            skipDuplicates: true,
          });
          electiveStats.createdFaculty += facultyResult.count;
          for (const bid of newFacultyBatchIds) {
            executedFacultyBatches.add(bid);
          }
        }
      });
    } catch (error) {
      errorCount += 1;
      console.error(
        `Elective batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
        error
      );
    }
  }

  const elapsed = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

  console.log(`\n========================================`);
  console.log(`Backfill Complete`);
  console.log(`========================================`);
  console.log(`StudentSections scanned : ${scannedCount}`);
  console.log(`Groups processed        : ${groupCount}`);
  console.log(`CourseAssignments found : ${courseAssignmentCount}`);
  console.log(`----------------------------------------`);
  console.log(`Registration candidates : ${candidateCount}`);
  console.log(`Already registered      : ${alreadyExistingCount}`);
  console.log(`Created                 : ${createdCount}`);
  printElectiveSummary(true);
  console.log(`Errors                  : ${errorCount}`);
  console.log(`----------------------------------------`);
  console.log(`Elapsed                 : ${elapsed}`);
  console.log(`========================================\n`);

  if (errorCount > 0) {
    throw new Error(`${errorCount} batch(es) failed`);
  }
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
