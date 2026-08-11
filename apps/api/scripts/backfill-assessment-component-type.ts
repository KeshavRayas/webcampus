import "dotenv/config";
import { AssessmentComponentType, db } from "@webcampus/db";

const DRY_RUN = process.argv.includes("--dry-run");
const VERIFY_ONLY = process.argv.includes("--verify");

type ParsedComponent = {
  componentType: AssessmentComponentType;
  sequence: number;
};

type VerificationIssue = {
  code: string;
  message: string;
};

function parseAssessmentTitle(title: string): ParsedComponent | null {
  const trimmed = title.trim();
  const theoryMatch = trimmed.match(/^Theory Exam\s*(\d+)/i);
  if (theoryMatch) {
    const sequence = Number.parseInt(theoryMatch[1]!, 10);
    if (sequence >= 1) {
      return { componentType: "THEORY", sequence };
    }
    return null;
  }
  if (/^Lab$/i.test(trimmed)) {
    return { componentType: "LAB", sequence: 1 };
  }
  if (/^AAT$/i.test(trimmed)) {
    return { componentType: "AAT", sequence: 1 };
  }
  return null;
}

async function countNullComponentTypes(): Promise<number> {
  const rows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "AssessmentTemplate"
    WHERE "componentType" IS NULL
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
  const rows = await db.$queryRaw<
    Array<{
      templateId: string;
      courseId: string;
      sequence: number;
      theoryMaxExams: number;
      title: string;
    }>
  >`
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
  return rows;
}

async function findInvalidLabOrAatSequence(): Promise<
  Array<{
    templateId: string;
    courseId: string;
    componentType: string;
    sequence: number;
  }>
> {
  const rows = await db.$queryRaw<
    Array<{
      templateId: string;
      courseId: string;
      componentType: string;
      sequence: number;
    }>
  >`
    SELECT id AS "templateId", "courseId", "componentType", sequence
    FROM "AssessmentTemplate"
    WHERE "componentType" IN ('LAB', 'AAT')
      AND sequence <> 1
  `;
  return rows;
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

async function findActiveComponentsMissingTemplates(): Promise<
  Array<{
    courseId: string;
    code: string;
    missingComponent: string;
  }>
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

async function runConfigurationValidation(): Promise<VerificationIssue[]> {
  const issues: VerificationIssue[] = [];

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
      message: `course=${row.courseId} (${row.code}) missing sequences: ${row.missingSequences.join(", ")}`,
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

async function runVerificationGate(): Promise<boolean> {
  const nullCount = await countNullComponentTypes();
  const duplicates = await findDuplicateSlots();
  const configIssues = await runConfigurationValidation();

  console.log("\n========================================");
  console.log("Assessment componentType verification");
  console.log("========================================");
  console.log(`NULL componentType count: ${nullCount}`);
  console.log(
    `Duplicate (courseId, componentType, sequence) groups: ${duplicates.length}`
  );
  console.log(`Configuration issues: ${configIssues.length}`);

  if (duplicates.length > 0) {
    console.log("\nDuplicates:");
    for (const row of duplicates) {
      console.log(
        `  course=${row.courseId} type=${row.componentType} seq=${row.sequence} count=${row.count}`
      );
    }
  }

  if (configIssues.length > 0) {
    console.log("\nConfiguration issues:");
    for (const issue of configIssues) {
      console.log(`  [${issue.code}] ${issue.message}`);
    }
  }

  const passed =
    nullCount === 0 && duplicates.length === 0 && configIssues.length === 0;

  console.log(`\nGate: ${passed ? "PASS" : "FAIL"}`);
  console.log("========================================\n");
  return passed;
}

async function backfill(): Promise<void> {
  const templates = await db.assessmentTemplate.findMany({
    select: {
      id: true,
      courseId: true,
      title: true,
      componentType: true,
      sequence: true,
    },
    orderBy: [{ courseId: "asc" }, { title: "asc" }],
  });

  let updated = 0;
  let skipped = 0;
  let unmatched = 0;
  const unmatchedRows: Array<{ id: string; courseId: string; title: string }> =
    [];

  for (const template of templates) {
    if (template.componentType !== null) {
      skipped++;
      continue;
    }

    const parsed = parseAssessmentTitle(template.title);
    if (!parsed) {
      unmatched++;
      unmatchedRows.push({
        id: template.id,
        courseId: template.courseId,
        title: template.title,
      });
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[dry-run] ${template.id} "${template.title}" → ${parsed.componentType} seq=${parsed.sequence}`
      );
      updated++;
      continue;
    }

    await db.assessmentTemplate.update({
      where: { id: template.id },
      data: {
        componentType: parsed.componentType,
        sequence: parsed.sequence,
      },
    });
    updated++;
  }

  console.log("\n========================================");
  console.log(DRY_RUN ? "Backfill preview (dry-run)" : "Backfill complete");
  console.log("========================================");
  console.log(`Templates scanned : ${templates.length}`);
  console.log(`Updated           : ${updated}`);
  console.log(`Already typed     : ${skipped}`);
  console.log(`Unmatched         : ${unmatched}`);

  if (unmatchedRows.length > 0) {
    console.log("\nUnmatched templates (manual fix required):");
    for (const row of unmatchedRows) {
      console.log(`  id=${row.id} course=${row.courseId} title="${row.title}"`);
    }
  }
  console.log("========================================\n");
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
        "Verification failed after backfill. Fix issues before running finalize migration."
      );
      process.exit(1);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
