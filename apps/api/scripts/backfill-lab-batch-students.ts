import "dotenv/config";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";

const allocateRoundRobin = async (sectionId: string): Promise<number> => {
  const [batches, sectionStudents] = await Promise.all([
    db.batch.findMany({
      where: { sectionId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { students: true } } },
    }),
    db.studentSection.findMany({
      where: { sectionId },
      orderBy: {
        student: {
          usn: "asc",
        },
      },
      select: { studentId: true },
    }),
  ]);

  if (batches.length === 0 || sectionStudents.length === 0) {
    return 0;
  }

  const allEmpty = batches.every((batch) => batch._count.students === 0);
  if (!allEmpty) {
    return 0;
  }

  const studentIds = Array.from(
    new Set(sectionStudents.map((entry) => entry.studentId))
  );

  await db.$transaction(async (tx) => {
    for (const batch of batches) {
      await tx.batch.update({
        where: { id: batch.id },
        data: {
          students: {
            set: [],
          },
        },
      });
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const studentsForBatch = studentIds.filter(
        (_, studentIndex) => studentIndex % batches.length === batchIndex
      );

      if (studentsForBatch.length === 0) {
        continue;
      }

      await tx.batch.update({
        where: { id: batches[batchIndex]!.id },
        data: {
          students: {
            connect: studentsForBatch.map((studentId) => ({ id: studentId })),
          },
        },
      });
    }
  });

  return studentIds.length;
};

const main = async () => {
  const sections = await db.section.findMany({
    where: {
      batches: {
        some: {},
      },
    },
    select: {
      id: true,
      name: true,
      batches: {
        select: { id: true },
      },
    },
  });

  let touchedSections = 0;
  let allocatedStudents = 0;

  for (const section of sections) {
    const allocated = await allocateRoundRobin(section.id);
    if (allocated > 0) {
      touchedSections += 1;
      allocatedStudents += allocated;
      logger.info("Backfilled lab batch students for section", {
        sectionId: section.id,
        sectionName: section.name,
        allocatedStudents: allocated,
      });
    }
  }

  logger.info("Lab batch backfill complete", {
    touchedSections,
    allocatedStudents,
  });
};

main()
  .catch((error) => {
    logger.error("Lab batch backfill failed", { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
