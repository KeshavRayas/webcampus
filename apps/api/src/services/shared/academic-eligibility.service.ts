import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import {
  findCourseAssignments,
  type CourseAssignmentWithFreeze,
} from "./course-assignment.service";
import { isBatchManagedCourse } from "./course-kind";

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
  reason: string | null;
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
  cycle?: "PHYSICS" | "CHEMISTRY";
  search?: string;
};

type FreezeFlags = {
  facultyFrozen: boolean;
  hodFrozen: boolean;
  adminFrozen: boolean;
};

type AttendanceRecord = {
  percentage: number | null;
  condonationStatus: string;
};

function isFrozen(freeze: FreezeFlags | null): boolean {
  if (!freeze) return false;
  return freeze.facultyFrozen || freeze.hodFrozen || freeze.adminFrozen;
}

function computeCourseEligibility(
  mark: { cieTotal: number | null; status: string } | null,
  attendance: AttendanceRecord | null,
  freeze: FreezeFlags | null
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

/**
 * Maps each student section's semester to its section id, so a course
 * registered for a given semester resolves to the section the student
 * actually belongs to in that semester (latest section wins on conflict).
 */
export function buildSectionBySemester(
  studentSections: {
    sectionId: string;
    section: { semesterId: string } | null;
  }[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const ss of studentSections) {
    const semId = ss.section?.semesterId;
    if (semId) map.set(semId, ss.sectionId);
  }
  return map;
}

/**
 * Resolves the section for a registration: prefer the section of the
 * registration's semester, falling back to the student's latest section.
 */
export function pickSectionForRegistration(
  semesterId: string,
  sectionBySemester: ReadonlyMap<string, string>,
  fallbackSectionId: string | null
): string | null {
  return sectionBySemester.get(semesterId) ?? fallbackSectionId;
}

function buildCourseReason(
  eligibility: {
    isFrozen: boolean;
    markEligible: boolean;
    attendanceEligible: boolean;
    eligible: boolean;
  },
  freeze: FreezeFlags | null,
  batchManaged: boolean
): string | null {
  if (!eligibility.isFrozen) {
    if (batchManaged) {
      return "Elective batch not assigned or no faculty mapped to batch";
    }
    return freeze
      ? "Not frozen by faculty/HOD/admin"
      : "No course assignment or freeze record found";
  }
  if (!eligibility.markEligible) return "Not mark-eligible (CIE status)";
  if (!eligibility.attendanceEligible) return "Attendance below 75%";
  return null;
}

function preferFrozenAssignment(
  current: CourseAssignmentWithFreeze | undefined,
  candidate: CourseAssignmentWithFreeze
): CourseAssignmentWithFreeze {
  if (!current) return candidate;
  if (isFrozen(candidate.freezes) && !isFrozen(current.freezes))
    return candidate;
  return current;
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

    const latestSectionId = student.studentSections[0]?.sectionId ?? null;
    const sectionBySemester = buildSectionBySemester(student.studentSections);
    const sectionIdFor = (semesterId: string): string | null =>
      pickSectionForRegistration(
        semesterId,
        sectionBySemester,
        latestSectionId
      );

    const courseIds = registrations.map((r) => r.courseId);

    const [marks, theoryAttendance, electiveAssignments] = await Promise.all([
      db.mark.findMany({
        where: { studentId, courseId: { in: courseIds } },
        select: { courseId: true, cieTotal: true, status: true },
      }),
      db.attendance.findMany({
        where: { studentId, courseId: { in: courseIds }, batchId: null },
        select: { courseId: true, percentage: true, condonationStatus: true },
      }),
      db.electiveStudentAssignment.findMany({
        where: { studentId, courseId: { in: courseIds } },
        select: {
          courseId: true,
          electiveBatch: {
            select: { facultyAssignment: { select: { facultyId: true } } },
          },
        },
      }),
    ]);

    const marksMap = new Map(marks.map((m) => [m.courseId, m]));
    const theoryAttendanceMap = new Map(
      theoryAttendance.map((a) => [a.courseId, a])
    );
    const electiveAssignmentMap = new Map(
      electiveAssignments.map((e) => [e.courseId, e])
    );
    const batchAttendanceMap = await this.buildStudentBatchAttendance(
      studentId,
      courseIds,
      theoryAttendanceMap
    );

    const assignmentMap = new Map<string, CourseAssignmentWithFreeze>();
    const batchAssignmentMap = new Map<string, CourseAssignmentWithFreeze>();
    const sectionsToQuery = new Set<string>();
    for (const reg of registrations) {
      const secId = sectionIdFor(reg.semesterId);
      if (secId) sectionsToQuery.add(secId);
    }

    for (const secId of sectionsToQuery) {
      const courseIdsForSection = [
        ...new Set(
          registrations
            .filter((r) => sectionIdFor(r.semesterId) === secId)
            .map((r) => r.courseId)
        ),
      ];
      const theoryAssignments = await findCourseAssignments({
        sectionId: secId,
        courseIds: courseIdsForSection,
        batchId: null,
      });
      for (const a of theoryAssignments) {
        const key = assignmentKey(secId, a.courseId);
        const existing = assignmentMap.get(key);
        if (existing) {
          const err = `Duplicate CourseAssignment for student=${studentId} section=${secId} course=${a.courseId}: ids ${existing.id}, ${a.id}`;
          logger.error(err);
          throw new Error(err);
        }
        assignmentMap.set(key, a);
      }

      const missingCourseIds = courseIdsForSection.filter(
        (cid) => !assignmentMap.has(assignmentKey(secId, cid))
      );
      if (missingCourseIds.length > 0) {
        const batchAssignments = await findCourseAssignments({
          sectionId: secId,
          courseIds: missingCourseIds,
          batchId: { not: null },
        });
        for (const a of batchAssignments) {
          const key = assignmentKey(secId, a.courseId);
          batchAssignmentMap.set(
            key,
            preferFrozenAssignment(batchAssignmentMap.get(key), a)
          );
        }
      }
    }

    const assignmentFor = (sectionId: string | null, courseId: string) => {
      if (!sectionId) return null;
      const key = assignmentKey(sectionId, courseId);
      return assignmentMap.get(key) ?? batchAssignmentMap.get(key) ?? null;
    };
    const attendanceFor = (courseId: string) =>
      theoryAttendanceMap.get(courseId) ??
      batchAttendanceMap.get(courseId) ??
      null;

    const courses: CourseEligibilityItem[] = [];
    let allFrozen = true;
    let allEligible = true;

    for (const reg of registrations) {
      const mark = marksMap.get(reg.courseId) ?? null;
      const attendance = attendanceFor(reg.courseId);
      const assignment = assignmentFor(
        sectionIdFor(reg.semesterId),
        reg.courseId
      );
      const batchManaged = isBatchManagedCourse(reg.course.courseType);
      let freeze: FreezeFlags | null = null;
      if (batchManaged) {
        const esa = electiveAssignmentMap.get(reg.courseId);
        freeze =
          esa && esa.electiveBatch.facultyAssignment
            ? { facultyFrozen: true, hodFrozen: true, adminFrozen: true }
            : null;
      } else {
        freeze = assignment?.freezes ?? null;
      }
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
        reason: buildCourseReason(eligibility, freeze, batchManaged),
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
      sectionName: student.studentSections[0]?.section?.name ?? null,
      courses,
      allCoursesFrozen: allFrozen,
      eligible: allEligible,
    };
  },

  async findEligibleStudents(
    filters: EligibilityFilters
  ): Promise<StudentEligibility[]> {
    const {
      academicTermId,
      semesterId,
      departmentId,
      sectionId,
      cycle,
      search,
    } = filters;

    const whereRegistrations: Record<string, unknown> = { academicTermId };
    if (semesterId) whereRegistrations.semesterId = semesterId;

    const studentWhere: Record<string, unknown> = {};
    if (departmentId) studentWhere.department = { id: departmentId };
    const sectionScope: Record<string, unknown> = {};
    if (sectionId) sectionScope.sectionId = sectionId;
    if (cycle) sectionScope.section = { cycle };
    if (Object.keys(sectionScope).length > 0) {
      studentWhere.studentSections = { some: sectionScope };
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
    const [marksMap, theoryAttendanceMap] = await Promise.all([
      this.buildMarksMap(studentIds, allCourseIds),
      this.buildAttendanceMap(studentIds, allCourseIds),
    ]);
    const batchAttendanceMap = await this.buildBatchAttendanceMap(
      studentIds,
      allCourseIds,
      theoryAttendanceMap
    );

    const electiveAssignments = await db.electiveStudentAssignment.findMany({
      where: { studentId: { in: studentIds }, courseId: { in: allCourseIds } },
      select: {
        studentId: true,
        courseId: true,
        electiveBatch: {
          select: { facultyAssignment: { select: { facultyId: true } } },
        },
      },
    });
    const electiveAssignmentMap = new Map(
      electiveAssignments.map((e) => [`${e.studentId}_${e.courseId}`, e])
    );

    const studentSectionInfo = new Map<
      string,
      { latestSectionId: string | null; bySemester: Map<string, string> }
    >();
    for (const [sid, regs] of studentRegMap) {
      const firstReg = regs[0];
      if (!firstReg) continue;
      const sections = firstReg.student.studentSections;
      studentSectionInfo.set(sid, {
        latestSectionId: sections[0]?.sectionId ?? null,
        bySemester: buildSectionBySemester(sections),
      });
    }
    const sectionIdFor = (sid: string, semesterId: string): string | null => {
      const info = studentSectionInfo.get(sid);
      if (!info) return null;
      return pickSectionForRegistration(
        semesterId,
        info.bySemester,
        info.latestSectionId
      );
    };

    const sectionCourseIds = new Map<string, string[]>();
    for (const [, regs] of studentRegMap) {
      for (const reg of regs) {
        const secId = sectionIdFor(reg.studentId, reg.semesterId);
        if (!secId) continue;
        const list = sectionCourseIds.get(secId) ?? [];
        if (!list.includes(reg.courseId)) list.push(reg.courseId);
        sectionCourseIds.set(secId, list);
      }
    }

    const assignmentMap = new Map<string, CourseAssignmentWithFreeze>();
    const batchAssignmentMap = new Map<string, CourseAssignmentWithFreeze>();
    for (const [secId, courseIdsForSection] of sectionCourseIds) {
      const theoryAssignments = await findCourseAssignments({
        sectionId: secId,
        courseIds: courseIdsForSection,
        batchId: null,
      });
      for (const a of theoryAssignments) {
        const key = assignmentKey(a.sectionId, a.courseId);
        const existing = assignmentMap.get(key);
        if (existing) {
          const err = `Duplicate CourseAssignment for section=${a.sectionId} course=${a.courseId}: ids ${existing.id}, ${a.id}`;
          logger.error(err);
          throw new Error(err);
        }
        assignmentMap.set(key, a);
      }

      const missingCourseIds = courseIdsForSection.filter(
        (cid) => !assignmentMap.has(assignmentKey(secId, cid))
      );
      if (missingCourseIds.length > 0) {
        const batchAssignments = await findCourseAssignments({
          sectionId: secId,
          courseIds: missingCourseIds,
          batchId: { not: null },
        });
        for (const a of batchAssignments) {
          const key = assignmentKey(secId, a.courseId);
          batchAssignmentMap.set(
            key,
            preferFrozenAssignment(batchAssignmentMap.get(key), a)
          );
        }
      }
    }

    const results: StudentEligibility[] = [];

    for (const [sid, regs] of studentRegMap) {
      const firstReg = regs[0];
      if (!firstReg) continue;
      const student = firstReg.student;

      const courses: CourseEligibilityItem[] = [];
      let allFrozen = true;
      let allEligible = true;

      for (const reg of regs) {
        const markKey = `${sid}_${reg.courseId}`;
        const mark = marksMap.get(markKey) ?? null;
        const attendance =
          theoryAttendanceMap.get(markKey) ??
          batchAttendanceMap.get(markKey) ??
          null;

        const secId = sectionIdFor(sid, reg.semesterId);
        let assignment: CourseAssignmentWithFreeze | null = null;
        if (secId) {
          const key = assignmentKey(secId, reg.courseId);
          assignment =
            assignmentMap.get(key) ?? batchAssignmentMap.get(key) ?? null;
        }

        const batchManaged = isBatchManagedCourse(reg.course.courseType);
        let freeze: FreezeFlags | null = null;
        if (batchManaged) {
          const esa = electiveAssignmentMap.get(`${sid}_${reg.courseId}`);
          freeze =
            esa && esa.electiveBatch.facultyAssignment
              ? { facultyFrozen: true, hodFrozen: true, adminFrozen: true }
              : null;
        } else {
          freeze = assignment?.freezes ?? null;
        }
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
          reason: buildCourseReason(eligibility, freeze, batchManaged),
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
        sectionName: student.studentSections[0]?.section?.name ?? null,
        courses,
        allCoursesFrozen: allFrozen,
        eligible: allEligible,
      });
    }

    return results;
  },

  async buildStudentBatchAttendance(
    studentId: string,
    courseIds: string[],
    theoryAttendanceMap: Map<string, AttendanceRecord>
  ): Promise<Map<string, AttendanceRecord>> {
    const missing = courseIds.filter((cid) => !theoryAttendanceMap.has(cid));
    if (missing.length === 0) return new Map();
    const records = await db.attendance.findMany({
      where: {
        studentId,
        courseId: { in: missing },
        batchId: { not: null },
      },
      select: { courseId: true, percentage: true, condonationStatus: true },
    });
    return new Map(
      records.map((a) => [
        a.courseId,
        { percentage: a.percentage, condonationStatus: a.condonationStatus },
      ])
    );
  },

  async buildBatchAttendanceMap(
    studentIds: string[],
    courseIds: string[],
    theoryAttendanceMap: Map<string, AttendanceRecord>
  ): Promise<Map<string, AttendanceRecord>> {
    const missingPairs: { sid: string; cid: string }[] = [];
    for (const sid of studentIds) {
      for (const cid of courseIds) {
        if (!theoryAttendanceMap.has(`${sid}_${cid}`)) {
          missingPairs.push({ sid, cid });
        }
      }
    }
    if (missingPairs.length === 0) return new Map();

    const records = await db.attendance.findMany({
      where: {
        studentId: { in: [...new Set(missingPairs.map((p) => p.sid))] },
        courseId: { in: courseIds },
        batchId: { not: null },
      },
      select: {
        studentId: true,
        courseId: true,
        percentage: true,
        condonationStatus: true,
      },
    });
    const map = new Map<string, AttendanceRecord>();
    for (const a of records) {
      const key = `${a.studentId}_${a.courseId}`;
      if (!map.has(key)) {
        map.set(key, {
          percentage: a.percentage,
          condonationStatus: a.condonationStatus,
        });
      }
    }
    return map;
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
  ): Promise<Map<string, AttendanceRecord>> {
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
    const map = new Map<string, AttendanceRecord>();
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
