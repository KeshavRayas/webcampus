import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { findCourseAssignments } from "./course-assignment.service";

export type CourseEligibilityItem = {
  courseAssignmentId: string;
  courseCode: string;
  courseName: string;
  courseType: string;
  credits: number;
  cieTotal: number | null;
  attendancePercentage: number | null;
  isFrozen: boolean;
  markEligible: boolean;
  attendanceEligible: boolean;
  eligible: boolean;
};

export type StudentEligibility = {
  studentId: string;
  usn: string;
  name: string;
  email: string | null;
  photo: string | null;
  departmentName: string;
  currentSemester: number;
  programType: string | null;
  sectionName: string | null;
  courses: CourseEligibilityItem[];
  allCoursesFrozen: boolean;
  eligible: boolean;
};

export type EligibilityFilters = {
  academicTermId: string;
  semesterId?: string;
  departmentId?: string;
  sectionId?: string;
  search?: string;
};

function isFrozen(
  freeze: {
    facultyFrozen: boolean;
    hodFrozen: boolean;
    adminFrozen: boolean;
  } | null
): boolean {
  if (!freeze) return false;
  return freeze.facultyFrozen || freeze.hodFrozen || freeze.adminFrozen;
}

function computeCourseEligibility(
  mark: { cieTotal: number | null; status: string } | null,
  attendance: { percentage: number | null; condonationStatus: string } | null,
  freeze: {
    facultyFrozen: boolean;
    hodFrozen: boolean;
    adminFrozen: boolean;
  } | null
): {
  isFrozen: boolean;
  markEligible: boolean;
  attendanceEligible: boolean;
  eligible: boolean;
} {
  const frozen = isFrozen(freeze);
  const markEligible = mark?.status === "ELIGIBLE";
  const attendancePct = attendance?.percentage ?? 0;
  const attendanceEligible =
    attendancePct >= 75 ||
    (attendance?.condonationStatus === "APPROVED" && attendancePct >= 75);
  return {
    isFrozen: frozen,
    markEligible,
    attendanceEligible,
    eligible: frozen && markEligible && attendanceEligible,
  };
}

function assignmentKey(sectionId: string, courseId: string): string {
  return `${sectionId}:${courseId}`;
}

export const academicEligibility = {
  async getCourseEligibility(
    studentId: string,
    academicTermId: string
  ): Promise<StudentEligibility | null> {
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { name: true, image: true, email: true } },
        admission: { select: { photo: true } },
        studentSections: {
          take: 1,
          orderBy: { semester: "desc" },
          include: { section: true },
        },
      },
    });
    if (!student) return null;

    const registrations = await db.courseRegistration.findMany({
      where: { studentId, academicTermId },
      include: { course: true },
    });

    if (registrations.length === 0) return null;

    const section = student.studentSections[0];
    const sectionId = section?.sectionId ?? null;
    const courseIds = registrations.map((r) => r.courseId);

    const [marks, attendanceRecords, assignments] = await Promise.all([
      db.mark.findMany({
        where: { studentId, courseId: { in: courseIds } },
        select: { courseId: true, cieTotal: true, status: true },
      }),
      db.attendance.findMany({
        where: { studentId, courseId: { in: courseIds }, batchId: null },
        select: { courseId: true, percentage: true, condonationStatus: true },
      }),
      sectionId
        ? findCourseAssignments({ sectionId, courseIds, batchId: null })
        : Promise.resolve([]),
    ]);

    const marksMap = new Map(marks.map((m) => [m.courseId, m]));
    const attendanceMap = new Map(
      attendanceRecords.map((a) => [a.courseId, a])
    );

    const assignmentMap = new Map<string, (typeof assignments)[number]>();
    for (const a of assignments) {
      const existing = assignmentMap.get(a.courseId);
      if (existing) {
        const err = `Duplicate CourseAssignment for student=${studentId} section=${sectionId} course=${a.courseId}: ids ${existing.id}, ${a.id}`;
        logger.error(err);
        throw new Error(err);
      }
      assignmentMap.set(a.courseId, a);
    }

    const courses: CourseEligibilityItem[] = [];
    let allFrozen = true;
    let allEligible = true;

    for (const reg of registrations) {
      const mark = marksMap.get(reg.courseId) ?? null;
      const attendance = attendanceMap.get(reg.courseId) ?? null;
      const assignment = assignmentMap.get(reg.courseId) ?? null;
      const freeze = assignment?.freezes ?? null;
      const eligibility = computeCourseEligibility(mark, attendance, freeze);

      const actualAssignmentId = assignment?.id ?? reg.id;
      if (!eligibility.isFrozen) allFrozen = false;
      if (!eligibility.eligible) allEligible = false;

      courses.push({
        courseAssignmentId: actualAssignmentId,
        courseCode: reg.course.code,
        courseName: reg.course.name,
        courseType: reg.course.courseType,
        credits: reg.course.totalCredits,
        cieTotal: mark?.cieTotal ?? null,
        attendancePercentage: attendance?.percentage ?? null,
        ...eligibility,
      });
    }

    const photo = student.admission?.photo ?? student.user.image ?? null;

    return {
      studentId: student.id,
      usn: student.usn,
      name: student.user.name,
      email: student.user.email ?? null,
      photo,
      departmentName: student.departmentName,
      currentSemester: student.currentSemester,
      programType: student.programType,
      sectionName: section?.section?.name ?? null,
      courses,
      allCoursesFrozen: allFrozen,
      eligible: allEligible,
    };
  },

  async findEligibleStudents(
    filters: EligibilityFilters
  ): Promise<StudentEligibility[]> {
    const { academicTermId, semesterId, departmentId, sectionId, search } =
      filters;

    const whereRegistrations: Record<string, unknown> = { academicTermId };
    if (semesterId) whereRegistrations.semesterId = semesterId;

    const studentWhere: Record<string, unknown> = {};
    if (departmentId) studentWhere.department = { id: departmentId };
    if (sectionId) {
      studentWhere.studentSections = { some: { sectionId } };
    }
    if (search) {
      studentWhere.OR = [
        { usn: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const registrations = await db.courseRegistration.findMany({
      where: {
        ...whereRegistrations,
        student:
          Object.keys(studentWhere).length > 0 ? studentWhere : undefined,
      } as Record<string, unknown>,
      orderBy: {
        student: {
          usn: "asc",
        },
      },
      include: {
        student: {
          include: {
            user: { select: { name: true, image: true, email: true } },
            admission: { select: { photo: true } },
            studentSections: {
              take: 1,
              orderBy: { semester: "desc" },
              include: { section: true },
            },
          },
        },
        course: true,
      },
    });

    const studentRegMap = new Map<string, typeof registrations>();
    for (const reg of registrations) {
      const existing = studentRegMap.get(reg.studentId) ?? [];
      existing.push(reg);
      studentRegMap.set(reg.studentId, existing);
    }

    const studentIds = Array.from(studentRegMap.keys());
    if (studentIds.length === 0) return [];

    const allCourseIds = [...new Set(registrations.map((r) => r.courseId))];
    const [marksMap, attendanceMap] = await Promise.all([
      this.buildMarksMap(studentIds, allCourseIds),
      this.buildAttendanceMap(studentIds, allCourseIds),
    ]);

    const sectionGroups = new Map<
      string,
      {
        regs: (typeof registrations)[number][];
        student: (typeof registrations)[number]["student"];
      }[]
    >();
    for (const [, regs] of studentRegMap) {
      const firstReg = regs[0];
      if (!firstReg) continue;
      const student = firstReg.student;
      const s = student.studentSections[0];
      const secId = s?.sectionId ?? "__no_section__";
      const group = sectionGroups.get(secId) ?? [];
      group.push({ regs, student });
      sectionGroups.set(secId, group);
    }

    const assignmentMap = new Map<
      string,
      {
        id: string;
        courseId: string;
        freezes: {
          facultyFrozen: boolean;
          hodFrozen: boolean;
          adminFrozen: boolean;
        } | null;
      }
    >();

    for (const [secId, group] of sectionGroups) {
      if (secId === "__no_section__") continue;
      const groupedCourseIds = [
        ...new Set(group.flatMap((g) => g.regs.map((r) => r.courseId))),
      ];
      const assignments = await findCourseAssignments({
        sectionId: secId,
        courseIds: groupedCourseIds,
        batchId: null,
      });

      for (const a of assignments) {
        const key = assignmentKey(a.sectionId, a.courseId);
        const existing = assignmentMap.get(key);
        if (existing) {
          const err = `Duplicate CourseAssignment for section=${a.sectionId} course=${a.courseId}: ids ${existing.id}, ${a.id}`;
          logger.error(err);
          throw new Error(err);
        }
        assignmentMap.set(key, a);
      }
    }

    const results: StudentEligibility[] = [];

    for (const [sid, regs] of studentRegMap) {
      const firstReg = regs[0];
      if (!firstReg) continue;
      const student = firstReg.student;
      const s = student.studentSections[0];
      const secId = s?.sectionId ?? null;

      const courses: CourseEligibilityItem[] = [];
      let allFrozen = true;
      let allEligible = true;

      for (const reg of regs) {
        const markKey = `${sid}_${reg.courseId}`;
        const mark = marksMap.get(markKey) ?? null;
        const attendance = attendanceMap.get(markKey) ?? null;

        let assignment: {
          id: string;
          courseId: string;
          freezes: {
            facultyFrozen: boolean;
            hodFrozen: boolean;
            adminFrozen: boolean;
          } | null;
        } | null = null;
        if (secId) {
          const key = assignmentKey(secId, reg.courseId);
          assignment = assignmentMap.get(key) ?? null;
        }

        const freeze = assignment?.freezes ?? null;
        const eligibility = computeCourseEligibility(mark, attendance, freeze);
        const actualAssignmentId = assignment?.id ?? reg.id;

        if (!eligibility.isFrozen) allFrozen = false;
        if (!eligibility.eligible) allEligible = false;

        courses.push({
          courseAssignmentId: actualAssignmentId,
          courseCode: reg.course.code,
          courseName: reg.course.name,
          courseType: reg.course.courseType,
          credits: reg.course.totalCredits,
          cieTotal: mark?.cieTotal ?? null,
          attendancePercentage: attendance?.percentage ?? null,
          ...eligibility,
        });
      }

      const photo = student.admission?.photo ?? student.user.image ?? null;
      results.push({
        studentId: sid,
        usn: student.usn,
        name: student.user.name,
        email: student.user.email ?? null,
        photo,
        departmentName: student.departmentName,
        currentSemester: student.currentSemester,
        programType: student.programType,
        sectionName: s?.section?.name ?? null,
        courses,
        allCoursesFrozen: allFrozen,
        eligible: allEligible,
      });
    }

    return results;
  },

  async buildMarksMap(
    studentIds: string[],
    courseIds: string[]
  ): Promise<Map<string, { cieTotal: number | null; status: string }>> {
    const marks = await db.mark.findMany({
      where: { studentId: { in: studentIds }, courseId: { in: courseIds } },
      select: { studentId: true, courseId: true, cieTotal: true, status: true },
    });
    const map = new Map<string, { cieTotal: number | null; status: string }>();
    for (const m of marks)
      map.set(`${m.studentId}_${m.courseId}`, {
        cieTotal: m.cieTotal,
        status: m.status,
      });
    return map;
  },

  async buildAttendanceMap(
    studentIds: string[],
    courseIds: string[]
  ): Promise<
    Map<string, { percentage: number | null; condonationStatus: string }>
  > {
    const records = await db.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        courseId: { in: courseIds },
        batchId: null,
      },
      select: {
        studentId: true,
        courseId: true,
        percentage: true,
        condonationStatus: true,
      },
    });
    const map = new Map<
      string,
      { percentage: number | null; condonationStatus: string }
    >();
    for (const a of records)
      map.set(`${a.studentId}_${a.courseId}`, {
        percentage: a.percentage,
        condonationStatus: a.condonationStatus,
      });
    return map;
  },

  isFrozen,
  computeCourseEligibility,
};
