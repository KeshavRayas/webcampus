import { db } from "@webcampus/db";

export const assertBatchBelongsToCourse = async (
  courseId: string,
  electiveBatchId: string
): Promise<void> => {
  const batch = await db.electiveBatch.findFirst({
    where: { id: electiveBatchId, courseId },
    select: { id: true },
  });
  if (!batch) {
    throw new Error("Selected batch does not belong to this course");
  }
};
