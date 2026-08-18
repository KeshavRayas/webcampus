import { db } from "@webcampus/db";

export const coeService = {
  getFrozenData: async () => {
    return db.freeze.findMany({
      where: {
        hodFrozen: true,
        adminFrozen: true,
        OR: [
          { courseAssignmentId: { not: null } },
          { electiveBatchFacultyId: { not: null } },
        ],
      },
      include: {
        courseAssignment: {
          include: {
            course: true,
            faculty: {
              include: { user: true },
            },
            section: true,
          },
        },
        electiveBatchFaculty: {
          include: {
            course: true,
            faculty: {
              include: { user: true },
            },
            electiveBatch: true,
          },
        },
      },
    });
  },

  getFinalLockedData: async () => {
    return db.freeze.findMany({
      where: {
        finalFrozen: true,
        OR: [
          { courseAssignmentId: { not: null } },
          { electiveBatchFacultyId: { not: null } },
        ],
      },
      include: {
        courseAssignment: {
          include: {
            course: true,
            section: true,
          },
        },
        electiveBatchFaculty: {
          include: {
            course: true,
            electiveBatch: true,
          },
        },
      },
    });
  },
};
