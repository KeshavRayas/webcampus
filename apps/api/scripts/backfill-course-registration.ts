import "dotenv/config";
import { db } from "@webcampus/db";

const DRY_RUN = process.argv.includes("--dry-run");

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

async function main() {
  const startTime = Date.now();

  // ── Query 1: All StudentSection records ──────────────────────────
  const studentSections = await db.studentSection.findMany({
    include: {
      section: {
        select: {
          semesterId: true,
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

  // ── Report summary before executing ──────────────────────────────
  const elapsedLabel = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

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
