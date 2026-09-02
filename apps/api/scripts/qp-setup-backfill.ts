import "dotenv/config";
import { db } from "@webcampus/db";
import {
  buildAssessmentSlots,
  findAssessmentForSlot,
  titleForAssessmentSlot,
} from "@webcampus/schemas/faculty";

const DRY_RUN = process.argv.includes("--dry-run");
const VERIFY_ONLY = process.argv.includes("--verify");

export type TargetCourse = Awaited<
  ReturnType<typeof fetchTargetCourses>
>[number];

async function fetchTargetCourses(): Promise<
  Array<{
    id: string;
    code: string;
    name: string;
    semesterId: string;
    theoryMaxExams: number;
    theoryExamMaxMarks: number;
    labMaxMarks: number;
    aatMaxMarks: number;
    assessments: Array<{
      id: string;
      title: string;
      totalMarks: number;
      componentType: "THEORY" | "LAB" | "AAT";
      sequence: number;
    }>;
  }>
> {
  return db.course.findMany({
    where: {
      approvalStatus: "APPROVED",
      coordinators: { some: {} },
    },
    select: {
      id: true,
      code: true,
      name: true,
      semesterId: true,
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
        },
      },
    },
    orderBy: { code: "asc" },
  });
}

export function computeMissingSlots(
  course: TargetCourse
): ReturnType<typeof buildAssessmentSlots> {
  return buildAssessmentSlots(course).filter((slot) => {
    return !findAssessmentForSlot(course.assessments, slot);
  });
}

function findZeroMarkSlots(course: TargetCourse) {
  return buildAssessmentSlots(course).filter((slot) => slot.maxMarks <= 0);
}

/**
 * Missing slots that are safe to create. Slots whose config yields
 * maxMarks <= 0 can never satisfy totalMarks >= 1, so they are excluded
 * everywhere (creation AND verification gate) to avoid permanent FAILs.
 */
export function computeActionableMissingSlots(
  course: TargetCourse
): ReturnType<typeof buildAssessmentSlots> {
  return computeMissingSlots(course).filter((slot) => slot.maxMarks > 0);
}

async function backfillCourse(
  course: TargetCourse,
  missingSlots: ReturnType<typeof buildAssessmentSlots>
): Promise<"created" | "conflict"> {
  try {
    await db.$transaction(async (tx) => {
      for (const slot of missingSlots) {
        await tx.assessmentTemplate.create({
          data: {
            courseId: course.id,
            semesterId: course.semesterId,
            title: slot.title,
            componentType: slot.componentType,
            sequence: slot.sequence,
            totalMarks: slot.maxMarks,
            questions: {
              // Single placeholder question worth full slot marks so the
              // computed total satisfies CreateAssessmentSchema parity.
              create: [
                {
                  part: "Part 1",
                  qNumber: "1",
                  marks: slot.maxMarks,
                },
              ],
            },
          },
        });
      }
    });
    return "created";
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
    if (code === "P2002" || code === "P2004") {
      // Unique (courseId, componentType, sequence) lost a race — treat as filled.
      return "conflict";
    }
    throw error;
  }
}

interface BackfillStats {
  coursesScanned: number;
  coursesWithGaps: number;
  templatesCreated: number;
  conflictsSkipped: number;
  zeroMarkWarnings: number;
}

async function backfill(): Promise<void> {
  const courses = await fetchTargetCourses();
  const stats: BackfillStats = {
    coursesScanned: courses.length,
    coursesWithGaps: 0,
    templatesCreated: 0,
    conflictsSkipped: 0,
    zeroMarkWarnings: 0,
  };

  for (const course of courses) {
    const zeroMarkSlots = findZeroMarkSlots(course);
    if (zeroMarkSlots.length > 0) {
      stats.zeroMarkWarnings += zeroMarkSlots.length;
      for (const slot of zeroMarkSlots) {
        console.warn(
          `[warn] ${course.code}: slot "${titleForAssessmentSlot(
            slot.componentType,
            slot.sequence
          )}" has maxMarks=${slot.maxMarks}; skipping invalid config`
        );
      }
    }

    const missingSlots = computeActionableMissingSlots(course);
    if (missingSlots.length === 0) {
      continue;
    }
    stats.coursesWithGaps++;

    for (const slot of missingSlots) {
      console.log(
        `${DRY_RUN ? "[dry-run] " : ""}${course.code} (${course.name}): ${
          slot.title
        } [${slot.componentType} seq=${slot.sequence}] ${slot.maxMarks} marks`
      );
    }

    if (DRY_RUN) {
      stats.templatesCreated += missingSlots.length;
      continue;
    }

    const outcome = await backfillCourse(course, missingSlots);
    if (outcome === "created") {
      stats.templatesCreated += missingSlots.length;
    } else {
      stats.conflictsSkipped += missingSlots.length;
    }
  }

  console.log("\n========================================");
  console.log(
    DRY_RUN ? "QP setup preview (dry-run)" : "QP setup backfill complete"
  );
  console.log("========================================");
  console.log(`Courses scanned       : ${stats.coursesScanned}`);
  console.log(`Courses with gaps     : ${stats.coursesWithGaps}`);
  console.log(`Templates created     : ${stats.templatesCreated}`);
  console.log(`Conflicts skipped     : ${stats.conflictsSkipped}`);
  console.log(`Zero-mark slot skips  : ${stats.zeroMarkWarnings}`);
  console.log("========================================\n");
}

interface StructuralAnomaly {
  courseCode: string;
  courseId: string;
  detail: string;
}

/**
 * Data-integrity checks over ALL courses (not just approved+coordinated):
 * - THEORY templates whose sequence exceeds theoryMaxExams (orphans left by
 *   config shrinks — hidden by the dashboard but still pooled by aggregation).
 * - LAB/AAT templates with sequence != 1.
 * - More than one LAB/AAT template per course.
 * NULL componentType/sequence and duplicate (courseId, componentType,
 * sequence) rows are impossible by schema constraints.
 */
async function findStructuralAnomalies(): Promise<StructuralAnomaly[]> {
  const courses = await db.course.findMany({
    select: {
      id: true,
      code: true,
      theoryMaxExams: true,
      assessments: {
        select: { componentType: true, sequence: true },
      },
    },
    orderBy: { code: "asc" },
  });

  const anomalies: StructuralAnomaly[] = [];

  for (const course of courses) {
    for (const assessment of course.assessments) {
      if (
        assessment.componentType === "THEORY" &&
        assessment.sequence > course.theoryMaxExams
      ) {
        anomalies.push({
          courseCode: course.code,
          courseId: course.id,
          detail: `THEORY seq=${assessment.sequence} exceeds theoryMaxExams=${course.theoryMaxExams}`,
        });
      }
      if (
        (assessment.componentType === "LAB" ||
          assessment.componentType === "AAT") &&
        assessment.sequence !== 1
      ) {
        anomalies.push({
          courseCode: course.code,
          courseId: course.id,
          detail: `${assessment.componentType} seq=${assessment.sequence} must be 1`,
        });
      }
    }

    const labCount = course.assessments.filter(
      (a) => a.componentType === "LAB"
    ).length;
    if (labCount > 1) {
      anomalies.push({
        courseCode: course.code,
        courseId: course.id,
        detail: `${labCount} LAB templates (expected at most 1)`,
      });
    }

    const aatCount = course.assessments.filter(
      (a) => a.componentType === "AAT"
    ).length;
    if (aatCount > 1) {
      anomalies.push({
        courseCode: course.code,
        courseId: course.id,
        detail: `${aatCount} AAT templates (expected at most 1)`,
      });
    }
  }

  return anomalies;
}

async function runVerificationGate(): Promise<boolean> {
  const courses = await fetchTargetCourses();
  const gaps: Array<{ course: TargetCourse; slots: string[] }> = [];

  for (const course of courses) {
    const missingTitles = computeActionableMissingSlots(course).map((slot) =>
      titleForAssessmentSlot(slot.componentType, slot.sequence)
    );
    if (missingTitles.length > 0) {
      gaps.push({ course, slots: missingTitles });
    }
  }

  const anomalies = await findStructuralAnomalies();

  console.log("\n========================================");
  console.log("QP setup slot coverage verification");
  console.log("========================================");
  console.log(`Approved+coordinated courses : ${courses.length}`);
  console.log(`Courses with missing slots   : ${gaps.length}`);

  if (gaps.length > 0) {
    console.log("\nMissing slots:");
    for (const gap of gaps) {
      console.log(
        `  ${gap.course.code} (${gap.course.id}): ${gap.slots.join(", ")}`
      );
    }
  }

  if (anomalies.length > 0) {
    console.log(`\nStructural anomalies          : ${anomalies.length}`);
    for (const anomaly of anomalies) {
      console.log(
        `  ${anomaly.courseCode} (${anomaly.courseId}): ${anomaly.detail}`
      );
    }
  }

  const passed = gaps.length === 0 && anomalies.length === 0;
  console.log(`\nGate: ${passed ? "PASS" : "FAIL"}`);
  console.log("========================================\n");
  return passed;
}

async function main(): Promise<void> {
  if (VERIFY_ONLY) {
    const passed = await runVerificationGate();
    process.exit(passed ? 0 : 1);
  }

  if (DRY_RUN) {
    console.log("\nDry-run: no writes will be performed.\n");
  }

  await backfill();

  if (!DRY_RUN) {
    const passed = await runVerificationGate();
    if (!passed) {
      console.error(
        "Verification failed after backfill. Some approved courses still lack QP templates."
      );
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
