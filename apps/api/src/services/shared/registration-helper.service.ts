import type { Prisma } from "@webcampus/db";

export type RegistrationFilterOptions = {
  courseId: string;
  semesterId: string;
  academicTermId: string;
  sectionId?: string;
  batchId?: string;
};

export function buildRegistrationWhere(
  options: RegistrationFilterOptions
): Prisma.CourseRegistrationWhereInput {
  const where: Prisma.CourseRegistrationWhereInput = {
    courseId: options.courseId,
    semesterId: options.semesterId,
    academicTermId: options.academicTermId,
  };

  if (options.sectionId || options.batchId) {
    where.student = {};

    if (options.sectionId) {
      where.student.studentSections = {
        some: { sectionId: options.sectionId },
      };
    }

    if (options.batchId) {
      where.student.batches = {
        some: { id: options.batchId },
      };
    }
  }

  return where;
}
