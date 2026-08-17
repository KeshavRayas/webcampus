import { PrismaClient } from "@webcampus/db";

type TimetableWhere = Record<string, unknown>;
type Slot = { label: string; startTime: string; endTime: string };

export interface TimetableEntry {
  id: string;
  academicYear: string;
  semesterId: string;
  departmentId?: string;
  courseId: string;
  facultyId: string;
  roomNumber: string;
  dayOfWeek:
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY";
  startTime: string;
  endTime: string;
  classType: "LECTURE" | "LAB" | "TUTORIAL" | "SEMINAR" | "OTHER";
  sectionId?: string;
  batchId?: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTimetableEntryDTO {
  academicYear: string;
  semesterId: string;
  departmentId?: string;
  courseId: string;
  facultyId: string;
  roomNumber: string;
  dayOfWeek:
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY";
  startTime: string;
  endTime: string;
  classType: "LECTURE" | "LAB" | "TUTORIAL" | "SEMINAR" | "OTHER";
  sectionId?: string;
  batchId?: string;
}

export interface UpdateTimetableEntryDTO {
  academicYear?: string;
  semesterId?: string;
  departmentId?: string;
  courseId?: string;
  facultyId?: string;
  roomNumber?: string;
  dayOfWeek?:
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY";
  startTime?: string;
  endTime?: string;
  classType?: "LECTURE" | "LAB" | "TUTORIAL" | "SEMINAR" | "OTHER";
  sectionId?: string;
  batchId?: string;
  status?: string;
}

export class TimetableService {
  static async createEntry(
    data: CreateTimetableEntryDTO,
    requestingUserId: string
  ): Promise<TimetableEntry> {
    void requestingUserId;
    // Validate course exists
    const course = await prisma.course.findUnique({
      where: { id: data.courseId },
    });
    if (!course) {
      throw new Error("Course not found");
    }

    // Validate faculty exists
    const faculty = await prisma.faculty.findUnique({
      where: { id: data.facultyId },
    });
    if (!faculty) {
      throw new Error("Faculty not found");
    }

    // Validate semester exists
    const semester = await prisma.semester.findUnique({
      where: { id: data.semesterId },
    });
    if (!semester) {
      throw new Error("Semester not found");
    }

    // Validate section exists if provided
    if (data.sectionId) {
      const section = await prisma.section.findUnique({
        where: { id: data.sectionId },
      });
      if (!section) {
        throw new Error("Section not found");
      }
    }

    // Validate batch exists if provided
    if (data.batchId) {
      const batch = await prisma.batch.findUnique({
        where: { id: data.batchId },
      });
      if (!batch) {
        throw new Error("Batch not found");
      }
    }

    // Check for time conflicts
    const conflictingEntry = await prisma.timetableEntry.findFirst({
      where: {
        departmentId: data.departmentId,
        courseId: data.courseId,
        facultyId: data.facultyId,
        sectionId: data.sectionId,
        batchId: data.batchId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
      },
    });

    if (conflictingEntry) {
      throw new Error(
        `Time conflict: ${conflictingEntry.courseId} already scheduled on ${data.dayOfWeek} from ${data.startTime} to ${data.endTime}`
      );
    }

    const entry = await prisma.timetableEntry.create({
      data: {
        academicYear: data.academicYear,
        semesterId: data.semesterId,
        departmentId: data.departmentId,
        courseId: data.courseId,
        facultyId: data.facultyId,
        roomNumber: data.roomNumber,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        classType: data.classType,
        sectionId: data.sectionId,
        batchId: data.batchId,
        status: "DRAFT",
      },
      include: {
        semester: {
          include: {
            academicTerm: true,
          },
        },
        course: true,
        faculty: true,
        department: true,
        section: true,
      },
    });

    return entry as TimetableEntry;
  }

  static async getEntriesBySemester(
    semesterId: string,
    departmentId?: string,
    sectionId?: string,
    facultyId?: string
  ) {
    const where: TimetableWhere = { semesterId };
    if (departmentId) {
      where.departmentId = departmentId;
    }
    if (sectionId) {
      where.sectionId = sectionId;
    }
    if (facultyId) {
      where.facultyId = facultyId;
    }

    return prisma.timetableEntry.findMany({
      where,
      include: {
        semester: {
          include: {
            academicTerm: true,
          },
        },
        course: true,
        faculty: true,
        department: true,
        section: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  static async getEntriesByDepartment(
    departmentId: string,
    semesterId?: string,
    sectionId?: string,
    facultyId?: string,
    dayOfWeek?: string
  ) {
    const where: TimetableWhere = { departmentId };
    if (semesterId) {
      where.semesterId = semesterId;
    }
    if (sectionId) {
      where.sectionId = sectionId;
    }
    if (facultyId) {
      where.facultyId = facultyId;
    }
    if (dayOfWeek) {
      where.dayOfWeek = dayOfWeek;
    }

    return prisma.timetableEntry.findMany({
      where,
      include: {
        semester: {
          include: {
            academicTerm: true,
          },
        },
        course: true,
        faculty: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  static async getEntriesByCourse(
    courseId: string,
    semesterId?: string,
    sectionId?: string
  ) {
    const where: TimetableWhere = { courseId };
    if (semesterId) {
      where.semesterId = semesterId;
    }
    if (sectionId) {
      where.sectionId = sectionId;
    }

    return prisma.timetableEntry.findMany({
      where,
      include: {
        semester: {
          include: {
            academicTerm: true,
          },
        },
        faculty: true,
        department: true,
        section: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  static async getEntriesByFaculty(
    facultyId: string,
    semesterId?: string,
    dayOfWeek?: string
  ) {
    const where: TimetableWhere = { facultyId };
    if (semesterId) {
      where.semesterId = semesterId;
    }
    if (dayOfWeek) {
      where.dayOfWeek = dayOfWeek;
    }

    return prisma.timetableEntry.findMany({
      where,
      include: {
        semester: {
          include: {
            academicTerm: true,
          },
        },
        course: true,
        department: true,
        section: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  static async getTodayEntries(semesterId: string, facultyId?: string) {
    const today = new Date();
    const dayOfWeek = today
      .toLocaleDateString("en-US", { weekday: "long" })
      .toUpperCase() as
      | "MONDAY"
      | "TUESDAY"
      | "WEDNESDAY"
      | "THURSDAY"
      | "FRIDAY"
      | "SATURDAY";

    return prisma.timetableEntry.findMany({
      where: {
        semesterId,
        ...(facultyId ? { facultyId } : {}),
        dayOfWeek,
        status: "PUBLISHED",
      },
      include: {
        course: true,
        faculty: true,
        section: true,
      },
      orderBy: [{ startTime: "asc" }],
    });
  }

  static async updateEntry(
    entryId: string,
    data: UpdateTimetableEntryDTO
  ): Promise<TimetableEntry> {
    // Build where clause for conflict check (exclude current entry)
    const conflictWhere: TimetableWhere = {
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
    };

    // Remove undefined keys
    Object.keys(conflictWhere).forEach(
      (key) => conflictWhere[key] === undefined && delete conflictWhere[key]
    );

    // If updating time/day, check for conflicts (excluding current entry)
    if (Object.keys(conflictWhere).length > 0) {
      const conflicting = await prisma.timetableEntry.findFirst({
        where: {
          ...conflictWhere,
          NOT: { id: entryId },
        },
      });

      if (conflicting) {
        throw new Error(
          `Time conflict: ${conflicting.courseId} already scheduled on ${conflicting.dayOfWeek} from ${conflicting.startTime} to ${conflicting.endTime}`
        );
      }
    }

    const entry = await prisma.timetableEntry.update({
      where: { id: entryId },
      data: {
        academicYear: data.academicYear,
        semesterId: data.semesterId,
        departmentId: data.departmentId,
        courseId: data.courseId,
        facultyId: data.facultyId,
        roomNumber: data.roomNumber,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        classType: data.classType,
        sectionId: data.sectionId,
        batchId: data.batchId,
        status: data.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined,
      },
      include: {
        semester: {
          include: {
            academicTerm: true,
          },
        },
        course: true,
        faculty: true,
        department: true,
        section: true,
      },
    });

    return entry as TimetableEntry;
  }

  static async deleteEntry(entryId: string): Promise<void> {
    await prisma.timetableEntry.delete({
      where: { id: entryId },
    });
  }

  static async getTemplateData(
    semesterId: string,
    sectionId?: string
  ): Promise<{
    courses: Array<Record<string, unknown>>;
    sections: unknown[];
    faculty: unknown[];
    rooms: string[];
    slots: unknown;
  }> {
    const where: TimetableWhere = { semesterId };
    if (sectionId) {
      where.sectionId = sectionId;
    }

    const courses = await prisma.course.findMany({
      where: {
        semesterId,
      },
      include: {
        department: true,
        semester: {
          include: {
            academicTerm: true,
          },
        },
        assignments: {
          where: sectionId ? { sectionId } : undefined,
          include: {
            faculty: { include: { user: { select: { name: true } } } },
            section: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { code: "asc" },
    });

    const sections = sectionId
      ? []
      : await prisma.section.findMany({
          where: { semesterId },
          include: { _count: { select: { courses: true } } },
        });

    const faculty = await prisma.faculty.findMany({
      include: { user: { select: { name: true, email: true } } },
    });

    const rooms = await prisma.timetableEntry.findMany({
      where: { semesterId },
      select: { roomNumber: true },
    });

    const timetableTemplate = await prisma.timetableTemplate.findFirst({
      where: { semesterId },
    });
    return {
      courses: courses.map(
        (course: {
          assignments: Array<{
            faculty: {
              id: string;
              shortName: string;
              user: { name: string | null } | null;
            };
            sectionId: string;
            section: { id: string; name: string };
          }>;
          [key: string]: unknown;
        }) => ({
          ...course,
          handlingFaculty: course.assignments.map((assignment) => ({
            id: assignment.faculty.id,
            name: assignment.faculty.user?.name ?? assignment.faculty.shortName,
            shortName: assignment.faculty.shortName,
            sectionId: assignment.sectionId,
            sectionName: assignment.section?.name,
          })),
        })
      ),
      sections,
      faculty,
      rooms: rooms.map((r: { roomNumber: string }) => r.roomNumber),
      slots: timetableTemplate?.slots ?? [],
    };
  }

  static async saveTemplate(
    departmentId: string,
    semesterId: string,
    slots: Slot[]
  ): Promise<unknown> {
    return prisma.timetableTemplate.upsert({
      where: { departmentId_semesterId: { departmentId, semesterId } },
      create: { departmentId, semesterId, slots },
      update: { slots },
    });
  }
}
const prisma = new PrismaClient();
