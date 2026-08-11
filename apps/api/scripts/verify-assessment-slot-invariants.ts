/**
 * Runtime invariant checker for assessment slot model.
 *
 * Run after migrations, backfill, or E2E QP workflows:
 *   bun run apps/api/scripts/verify-assessment-slot-invariants.ts
 *
 * Config-change note (Theory 3 → Theory 2 after templates exist):
 * - Dashboard hides excess slots (buildAssessmentSlots uses theoryMaxExams).
 * - Orphan templates remain in DB (not auto-deleted).
 * - Aggregation still includes all THEORY templates in the BEST_N pool.
 * - This script reports THEORY_SEQUENCE_EXCEEDS_MAX; backfill --verify fails too.
 */
import "dotenv/config";
import { db } from "@webcampus/db";

type VerificationIssue = {
  code: string;
  message: string;
};

async function countNullComponentTypes(): Promise<number> {
  const rows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "AssessmentTemplate"
    WHERE "componentType" IS NULL
  `;
  return Number(rows[0]?.count ?? 0);
}

async function countNullSequences(): Promise<number> {
  const rows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "AssessmentTemplate"
    WHERE sequence IS NULL
  `;
  return Number(rows[0]?.count ?? 0);
}

async function findDuplicateSlots(): Promise<
  Array<{
    courseId: string;
    componentType: string;
    sequence: number;
    count: number;
  }>
> {
  const rows = await db.$queryRaw<
    Array<{
      courseId: string;
      componentType: string;
      sequence: number;
      count: bigint;
    }>
  >`
    SELECT "courseId", "componentType", "sequence", COUNT(*)::bigint AS count
    FROM "AssessmentTemplate"
    WHERE "componentType" IS NOT NULL
    GROUP BY "courseId", "componentType", "sequence"
    HAVING COUNT(*) > 1
  `;
  return rows.map((row) => ({
    courseId: row.courseId,
    componentType: row.componentType,
    sequence: row.sequence,
    count: Number(row.count),
  }));
}

async function findTheorySequenceBeyondMax(): Promise<
  Array<{
    templateId: string;
    courseId: string;
    sequence: number;
    theoryMaxExams: number;
    title: string;
  }>
> {
  return db.$queryRaw`
    SELECT
      t.id AS "templateId",
      t."courseId",
      t.sequence,
      c."theoryMaxExams",
      t.title
    FROM "AssessmentTemplate" t
    INNER JOIN "Course" c ON c.id = t."courseId"
    WHERE t."componentType" = 'THEORY'
      AND t.sequence > c."theoryMaxExams"
  `;
}

async function findInvalidLabOrAatSequence(): Promise<
  Array<{
    templateId: string;
    courseId: string;
    componentType: string;
    sequence: number;
  }>
> {
  return db.$queryRaw`
    SELECT id AS "templateId", "courseId", "componentType", sequence
    FROM "AssessmentTemplate"
    WHERE "componentType" IN ('LAB', 'AAT')
      AND sequence <> 1
  `;
}

async function findExcessComponentCounts(): Promise<
  Array<{ courseId: string; componentType: string; count: number }>
> {
  const rows = await db.$queryRaw<
    Array<{ courseId: string; componentType: string; count: bigint }>
  >`
    SELECT "courseId", "componentType", COUNT(*)::bigint AS count
    FROM "AssessmentTemplate"
    WHERE "componentType" IN ('LAB', 'AAT')
    GROUP BY "courseId", "componentType"
    HAVING COUNT(*) > 1
  `;
  return rows.map((row) => ({
    courseId: row.courseId,
    componentType: row.componentType,
    count: Number(row.count),
  }));
}

async function findTheorySequenceGaps(): Promise<
  Array<{ courseId: string; code: string; missingSequences: number[] }>
> {
  const courses = await db.course.findMany({
    select: {
      id: true,
      code: true,
      assessments: {
        where: { componentType: "THEORY" },
        select: { sequence: true },
      },
    },
  });

  const issues: Array<{
    courseId: string;
    code: string;
    missingSequences: number[];
  }> = [];

  for (const course of courses) {
    const sequences = course.assessments
      .map((a) => a.sequence)
      .sort((a, b) => a - b);

    if (sequences.length <= 1) {
      continue;
    }

    const min = sequences[0]!;
    const max = sequences[sequences.length - 1]!;
    const present = new Set(sequences);
    const missingSequences: number[] = [];

    for (let sequence = min; sequence <= max; sequence++) {
      if (!present.has(sequence)) {
        missingSequences.push(sequence);
      }
    }

    if (missingSequences.length > 0) {
      issues.push({
        courseId: course.id,
        code: course.code,
        missingSequences,
      });
    }
  }

  return issues;
}

async function findMissingTheorySlots(): Promise<
  Array<{
    courseId: string;
    code: string;
    theoryMaxExams: number;
    missingSequences: number[];
  }>
> {
  const courses = await db.course.findMany({
    select: {
      id: true,
      code: true,
      theoryMaxExams: true,
      assessments: {
        where: { componentType: "THEORY" },
        select: { sequence: true },
      },
    },
  });

  const issues: Array<{
    courseId: string;
    code: string;
    theoryMaxExams: number;
    missingSequences: number[];
  }> = [];

  for (const course of courses) {
    if (course.theoryMaxExams <= 0) {
      continue;
    }

    const present = new Set(course.assessments.map((a) => a.sequence));
    const missingSequences: number[] = [];

    for (let sequence = 1; sequence <= course.theoryMaxExams; sequence++) {
      if (!present.has(sequence)) {
        missingSequences.push(sequence);
      }
    }

    if (missingSequences.length > 0) {
      issues.push({
        courseId: course.id,
        code: course.code,
        theoryMaxExams: course.theoryMaxExams,
        missingSequences,
      });
    }
  }

  return issues;
}

async function findActiveComponentsMissingTemplates(): Promise<
  Array<{ courseId: string; code: string; missingComponent: string }>
> {
  const courses = await db.course.findMany({
    select: {
      id: true,
      code: true,
      theoryMaxExams: true,
      labMaxMarks: true,
      aatMaxMarks: true,
      assessments: {
        select: { componentType: true },
      },
    },
  });

  const issues: Array<{
    courseId: string;
    code: string;
    missingComponent: string;
  }> = [];

  for (const course of courses) {
    const theoryCount = course.assessments.filter(
      (a) => a.componentType === "THEORY"
    ).length;
    const labCount = course.assessments.filter(
      (a) => a.componentType === "LAB"
    ).length;
    const aatCount = course.assessments.filter(
      (a) => a.componentType === "AAT"
    ).length;

    if (course.theoryMaxExams > 0 && theoryCount === 0) {
      issues.push({
        courseId: course.id,
        code: course.code,
        missingComponent: "THEORY",
      });
    }
    if (course.labMaxMarks > 0 && labCount === 0) {
      issues.push({
        courseId: course.id,
        code: course.code,
        missingComponent: "LAB",
      });
    }
    if (course.aatMaxMarks > 0 && aatCount === 0) {
      issues.push({
        courseId: course.id,
        code: course.code,
        missingComponent: "AAT",
      });
    }
  }

  return issues;
}

async function collectIssues(): Promise<VerificationIssue[]> {
  const issues: VerificationIssue[] = [];

  const nullComponentTypeCount = await countNullComponentTypes();
  if (nullComponentTypeCount > 0) {
    issues.push({
      code: "NULL_COMPONENT_TYPE",
      message: `${nullComponentTypeCount} template(s) have NULL componentType`,
    });
  }

  const nullSequenceCount = await countNullSequences();
  if (nullSequenceCount > 0) {
    issues.push({
      code: "NULL_SEQUENCE",
      message: `${nullSequenceCount} template(s) have NULL sequence`,
    });
  }

  const duplicates = await findDuplicateSlots();
  for (const row of duplicates) {
    issues.push({
      code: "DUPLICATE_SLOT",
      message: `course=${row.courseId} type=${row.componentType} seq=${row.sequence} count=${row.count}`,
    });
  }

  const theoryBeyondMax = await findTheorySequenceBeyondMax();
  for (const row of theoryBeyondMax) {
    issues.push({
      code: "THEORY_SEQUENCE_EXCEEDS_MAX",
      message: `template=${row.templateId} course=${row.courseId} seq=${row.sequence} > theoryMaxExams=${row.theoryMaxExams} title="${row.title}"`,
    });
  }

  const invalidLabAatSeq = await findInvalidLabOrAatSequence();
  for (const row of invalidLabAatSeq) {
    issues.push({
      code: "LAB_AAT_SEQUENCE_NOT_ONE",
      message: `template=${row.templateId} course=${row.courseId} type=${row.componentType} seq=${row.sequence}`,
    });
  }

  const excessCounts = await findExcessComponentCounts();
  for (const row of excessCounts) {
    issues.push({
      code: "EXCESS_COMPONENT_TEMPLATES",
      message: `course=${row.courseId} type=${row.componentType} count=${row.count}`,
    });
  }

  const sequenceGaps = await findTheorySequenceGaps();
  for (const row of sequenceGaps) {
    issues.push({
      code: "THEORY_SEQUENCE_GAP",
      message: `course=${row.courseId} (${row.code}) missing sequences in range: ${row.missingSequences.join(", ")}`,
    });
  }

  const missingTheorySlots = await findMissingTheorySlots();
  for (const row of missingTheorySlots) {
    issues.push({
      code: "THEORY_SLOT_MISSING",
      message: `course=${row.courseId} (${row.code}) theoryMaxExams=${row.theoryMaxExams} missing slots: ${row.missingSequences.join(", ")}`,
    });
  }

  const missingActive = await findActiveComponentsMissingTemplates();
  for (const row of missingActive) {
    issues.push({
      code: "ACTIVE_COMPONENT_MISSING_TEMPLATE",
      message: `course=${row.courseId} (${row.code}) missing ${row.missingComponent} template`,
    });
  }

  return issues;
}

async function main(): Promise<void> {
  try {
    const issues = await collectIssues();

    console.log("\n========================================");
    console.log("Assessment slot invariant verification");
    console.log("========================================");
    console.log(`Issues found: ${issues.length}`);

    if (issues.length > 0) {
      console.log("\nDetails:");
      for (const issue of issues) {
        console.log(`  [${issue.code}] ${issue.message}`);
      }
      console.log("\nFAILED — fix issues above before release.");
      process.exit(1);
    }

    console.log("\nPASSED — all assessment slot invariants satisfied.");
  } catch (error) {
    const prismaCode =
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined;

    if (prismaCode === "P2022" || prismaCode === "P2010") {
      console.error(
        "\nSchema not migrated: AssessmentTemplate.componentType/sequence columns missing."
      );
      console.error(
        "Apply Migration A (cie_aggregation_expand) before running this verifier."
      );
      process.exit(1);
    }
    throw error;
  }
}

main()
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
