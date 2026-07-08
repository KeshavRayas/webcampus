import "dotenv/config";
import { db } from "@webcampus/db";
import { recomputeStudentMark } from "../src/services/shared/mark-sync.service";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

async function main() {
  const startTime = Date.now();
  let total = 0;
  let success = 0;
  let skipped = 0;
  let failed = 0;

  if (DRY_RUN) {
    const count = await db.courseRegistration.count();
    console.log(`\n========================================`);
    console.log(`Backfill Marks Preview (dry-run)`);
    console.log(`========================================`);
    console.log(`Course registrations found: ${count}`);
    console.log(`Would recompute Mark for each (upsert cieTotal + status)`);
    console.log(`========================================\n`);
    return;
  }

  console.log(`\nBackfilling Mark records from StudentAssessment...\n`);

  let skip = 0;
  while (true) {
    const registrations = await db.courseRegistration.findMany({
      skip,
      take: BATCH_SIZE,
      select: { studentId: true, courseId: true },
      orderBy: [{ courseId: "asc" }, { studentId: "asc" }],
    });

    if (registrations.length === 0) break;

    for (const reg of registrations) {
      total++;
      try {
        const existing = await db.mark.findUnique({
          where: {
            studentId_courseId: {
              studentId: reg.studentId,
              courseId: reg.courseId,
            },
          },
          select: { id: true },
        });
        if (!existing) skipped++;

        await recomputeStudentMark(reg.studentId, reg.courseId);
        success++;
      } catch (err) {
        failed++;
        console.error(
          `Failed: student=${reg.studentId}, course=${reg.courseId}`,
          err
        );
      }

      if (total % 100 === 0) {
        process.stdout.write(`\rProgress: ${total} processed...`);
      }
    }

    skip += registrations.length;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n\n========================================`);
  console.log(`Backfill Marks Complete`);
  console.log(`========================================`);
  console.log(`Processed : ${total}`);
  console.log(`Succeeded : ${success}`);
  console.log(`Skipped   : ${skipped} (new records created)`);
  console.log(`Failed    : ${failed}`);
  console.log(`----------------------------------------`);
  console.log(`Elapsed   : ${elapsed}s`);
  console.log(`========================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} record(s) failed`);
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
