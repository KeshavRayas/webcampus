import { db } from "@webcampus/db";

export type ResolvedAttendanceContext = {
  courseId: string;
  sectionId: string;
  facultyId: string;
  batchId: string | null;
};

export const resolveAttendanceContext = async (
  userId: string,
  courseId: string,
  sectionId?: string | null,
  batchId?: string | null
): Promise<ResolvedAttendanceContext> => {
  const faculty = await db.faculty.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!faculty) {
    throw new Error("Faculty not found");
  }

  if (!sectionId) {
    throw new Error("Section not found");
  }

  return {
    courseId,
    facultyId: faculty.id,
    sectionId,
    batchId: batchId ?? null,
  };
};

export const resolveCourseAssignment = async (
  context: ResolvedAttendanceContext
): Promise<{
  id: string;
  departmentId: string;
  semester: number;
  academicYear: string;
}> => {
  const assignment = await db.courseAssignment.findFirst({
    where: {
      courseId: context.courseId,
      facultyId: context.facultyId,
      sectionId: context.sectionId,
      batchId: context.batchId,
    },
    select: {
      id: true,
      departmentId: true,
      semester: true,
      academicYear: true,
    },
  });

  if (!assignment) {
    throw new Error("Course assignment not found");
  }

  return assignment;
};
