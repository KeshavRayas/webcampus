import "dotenv/config";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";

const SEMESTER_TYPES = ["odd", "even", "supplementary"] as const;
type SemesterTypeValue = (typeof SEMESTER_TYPES)[number];

const PROGRAM_TYPES = ["UG", "PG"] as const;
type ProgramTypeValue = (typeof PROGRAM_TYPES)[number];

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);

type CycleValue = "PHYSICS" | "CHEMISTRY" | "NONE";

interface CliArgs {
  department?: string;
  semesterNumber?: number;
  programType?: ProgramTypeValue;
  termType?: SemesterTypeValue;
  termYear?: string;
  dryRun: boolean;
}

function parseCliArgs(argv: string[]): CliArgs {
  const read = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`);
    if (index === -1) return undefined;
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }
    return value;
  };

  const rawProgramType = read("program-type");
  if (
    rawProgramType !== undefined &&
    !PROGRAM_TYPES.includes(rawProgramType as ProgramTypeValue)
  ) {
    throw new Error(
      `Invalid --program-type "${rawProgramType}". Allowed: ${PROGRAM_TYPES.join(", ")}`
    );
  }

  const rawTermType = read("term-type");
  if (
    rawTermType !== undefined &&
    !SEMESTER_TYPES.includes(rawTermType as SemesterTypeValue)
  ) {
    throw new Error(
      `Invalid --term-type "${rawTermType}". Allowed: ${SEMESTER_TYPES.join(", ")}`
    );
  }

  const rawSemesterNumber = read("semester-number");
  let semesterNumber: number | undefined;
  if (rawSemesterNumber !== undefined) {
    semesterNumber = Number(rawSemesterNumber);
    if (
      !Number.isInteger(semesterNumber) ||
      semesterNumber < 1 ||
      semesterNumber > 8
    ) {
      throw new Error(
        `Invalid --semester-number "${rawSemesterNumber}". Must be an integer between 1 and 8`
      );
    }
  }

  return {
    department: read("department"),
    semesterNumber,
    programType: rawProgramType as ProgramTypeValue | undefined,
    termType: rawTermType as SemesterTypeValue | undefined,
    termYear: read("term-year"),
    dryRun: argv.includes("--dry-run"),
  };
}

interface StudentRow {
  id: string;
  usn: string;
  departmentName: string;
  currentSemester: number;
  programType: "UG" | "PG";
  semesterId: string;
  academicTermId: string;
  cycle: CycleValue | null;
}

interface CourseRow {
  id: string;
  code: string;
  name: string;
  courseType: string;
  departmentName: string | null;
  numberOfBatches: number | null;
  studentsPerBatch: number | null;
  openElectiveEligibility: string | null;
  openElectiveDepartments: { department: { name: string } }[];
  electiveBatches: { id: string; name: string; sortOrder: number }[];
}

interface Cohort {
  key: string;
  programType: "UG" | "PG";
  semesterId: string;
  academicTermId: string;
  departmentName: string;
  cycle: "PHYSICS" | "CHEMISTRY" | null;
  isFirstYearUg: boolean;
  students: StudentRow[];
}

interface StudentPlan {
  student: StudentRow;
  coreCourseIds: string[];
  peCourseId?: string;
  oe?: { courseId: string; batchId: string | null; needsAssignment: boolean };
}

function peCourseCapacity(
  numberOfBatches: number | null,
  studentsPerBatch: number | null
): number {
  return Math.max(0, numberOfBatches ?? 0) * Math.max(0, studentsPerBatch ?? 0);
}

function isOeVisible(course: CourseRow, student: StudentRow): boolean {
  const eligibility = course.openElectiveEligibility ?? "ALL";
  if (eligibility === "ALL") return true;
  if (eligibility === "ALL_EXCEPT_OWNER") {
    return course.departmentName !== student.departmentName;
  }
  if (eligibility === "CUSTOM") {
    return (
      course.openElectiveDepartments?.some(
        (entry) => entry.department.name === student.departmentName
      ) ?? false
    );
  }
  return true;
}

async function fetchCohortCourses(cohort: Cohort): Promise<CourseRow[]> {
  const department = cohort.isFirstYearUg
    ? null
    : await db.department.findUnique({
        where: { name: cohort.departmentName },
        select: { id: true },
      });
  if (!cohort.isFirstYearUg && !department) {
    throw new Error(
      `Department "${cohort.departmentName}" not found for cohort ${cohort.key}`
    );
  }

  return db.course.findMany({
    where: {
      semesterId: cohort.semesterId,
      approvalStatus: "APPROVED",
      ...(department
        ? { OR: [{ departmentId: department.id }, { courseType: "OE" }] }
        : {}),
      ...(cohort.cycle ? { cycle: cohort.cycle } : {}),
    },
    select: {
      id: true,
      code: true,
      name: true,
      courseType: true,
      departmentName: true,
      numberOfBatches: true,
      studentsPerBatch: true,
      openElectiveEligibility: true,
      openElectiveDepartments: {
        select: { department: { select: { name: true } } },
      },
      electiveBatches: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, sortOrder: true },
      },
    },
    orderBy: { code: "asc" },
  });
}

class OccupancyTracker {
  peCapacity = new Map<string, number>();
  peTaken = new Map<string, number>();
  batchInfo = new Map<
    string,
    { courseId: string; name: string; capacity: number }
  >();
  batchTaken = new Map<string, number>();
  courseLabels = new Map<string, { code: string; courseType: string }>();

  async ensurePeCourses(courses: CourseRow[]): Promise<void> {
    const missing = courses.filter((course) => !this.peCapacity.has(course.id));
    for (const course of missing) {
      this.peCapacity.set(
        course.id,
        peCourseCapacity(course.numberOfBatches, course.studentsPerBatch)
      );
      this.peTaken.set(course.id, 0);
      this.courseLabels.set(course.id, {
        code: course.code,
        courseType: course.courseType,
      });
    }
    if (missing.length > 0) {
      const counts = await db.courseRegistration.groupBy({
        by: ["courseId"],
        where: {
          courseId: { in: missing.map((course) => course.id) },
          status: "ACTIVE",
          registrationType: { in: ["REGULAR", "RE_REGISTRATION"] },
        },
        _count: { _all: true },
      });
      for (const row of counts) {
        this.peTaken.set(row.courseId, row._count._all);
      }
    }
  }

  async ensureOeBatches(courses: CourseRow[]): Promise<void> {
    const missingBatches = courses.flatMap((course) =>
      course.electiveBatches.filter((batch) => !this.batchInfo.has(batch.id))
    );
    for (const course of courses) {
      const capacity = course.studentsPerBatch ?? 0;
      this.courseLabels.set(course.id, {
        code: course.code,
        courseType: course.courseType,
      });
      for (const batch of course.electiveBatches) {
        if (this.batchInfo.has(batch.id)) continue;
        this.batchInfo.set(batch.id, {
          courseId: course.id,
          name: `${course.code} / ${batch.name}`,
          capacity,
        });
        this.batchTaken.set(batch.id, 0);
      }
    }
    if (missingBatches.length > 0) {
      const counts = await db.electiveStudentAssignment.groupBy({
        by: ["electiveBatchId"],
        where: {
          electiveBatchId: { in: missingBatches.map((batch) => batch.id) },
        },
        _count: { _all: true },
      });
      for (const row of counts) {
        this.batchTaken.set(row.electiveBatchId, row._count._all);
      }
    }
  }
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  logger.info(
    `Registering students to all available courses${args.dryRun ? " (DRY RUN)" : ""}, filters=${JSON.stringify(
      {
        department: args.department ?? "(all)",
        semesterNumber: args.semesterNumber ?? "(all)",
        programType: args.programType ?? "(all)",
        termType: args.termType ?? "(all)",
        termYear: args.termYear ?? "(all)",
      }
    )}`
  );

  const students = await db.student.findMany({
    where: {
      semesterId: { not: null },
      academicTermId: { not: null },
      programType: { not: null },
      ...(args.department ? { departmentName: args.department } : {}),
      ...(args.semesterNumber !== undefined
        ? { currentSemester: args.semesterNumber }
        : {}),
      ...(args.programType ? { programType: args.programType } : {}),
      ...(args.termType ? { academicTermType: args.termType } : {}),
      ...(args.termYear ? { academicTermYear: args.termYear } : {}),
    },
    select: {
      id: true,
      usn: true,
      departmentName: true,
      currentSemester: true,
      programType: true,
      semesterId: true,
      academicTermId: true,
      studentSections: {
        select: { section: { select: { cycle: true } } },
      },
    },
    orderBy: { usn: "asc" },
  });

  const validStudents: StudentRow[] = [];
  let skippedContext = 0;
  for (const student of students) {
    if (
      !student.semesterId ||
      !student.academicTermId ||
      !student.programType
    ) {
      skippedContext += 1;
      logger.warn(
        `Skipping student ${student.usn}: incomplete academic context (semesterId/academicTermId/programType)`
      );
      continue;
    }
    const cycle =
      student.studentSections
        .map((item) => item.section.cycle)
        .find((value) => value === "PHYSICS" || value === "CHEMISTRY") ?? null;
    validStudents.push({
      id: student.id,
      usn: student.usn,
      departmentName: student.departmentName,
      currentSemester: student.currentSemester,
      programType: student.programType,
      semesterId: student.semesterId,
      academicTermId: student.academicTermId,
      cycle,
    });
  }

  // Cohorts group students that share an identical course set and
  // distribution pool: same term + semester + program type, scoped by
  // PHYSICS/CHEMISTRY cycle for first-year UG or by department otherwise.
  const cohorts = new Map<string, Cohort>();
  for (const student of validStudents) {
    const isFirstYearUg =
      student.programType === "UG" &&
      FIRST_YEAR_UG_SEMESTERS.has(student.currentSemester);
    let scopeKey: string;
    let cycle: "PHYSICS" | "CHEMISTRY" | null = null;
    if (isFirstYearUg) {
      if (student.cycle !== "PHYSICS" && student.cycle !== "CHEMISTRY") {
        skippedContext += 1;
        logger.warn(
          `Skipping first-year UG student ${student.usn}: no PHYSICS/CHEMISTRY section cycle resolved`
        );
        continue;
      }
      cycle = student.cycle;
      scopeKey = `cycle:${cycle}`;
    } else {
      scopeKey = `dept:${student.departmentName}`;
    }
    const key = [
      student.programType,
      student.semesterId,
      student.academicTermId,
      scopeKey,
    ].join("|");
    let cohort = cohorts.get(key);
    if (!cohort) {
      cohort = {
        key,
        programType: student.programType,
        semesterId: student.semesterId,
        academicTermId: student.academicTermId,
        departmentName: student.departmentName,
        cycle,
        isFirstYearUg,
        students: [],
      };
      cohorts.set(key, cohort);
    }
    cohort.students.push(student);
  }

  const sortedCohorts = Array.from(cohorts.values()).sort((a, b) =>
    a.key.localeCompare(b.key)
  );

  const occupancy = new OccupancyTracker();
  const warnings: string[] = [];
  let roundRobinIndex = 0;
  let fullyRegisteredStudents = 0;
  let coreRegsCreated = 0;
  let peRegsCreated = 0;
  let oeRegsCreated = 0;
  const createdByCourse = new Map<string, number>();

  const bumpCreated = (courseId: string): void => {
    createdByCourse.set(courseId, (createdByCourse.get(courseId) ?? 0) + 1);
  };

  for (const cohort of sortedCohorts) {
    const courses = await fetchCohortCourses(cohort);
    const coreCourses = courses.filter(
      (course) => course.courseType !== "PE" && course.courseType !== "OE"
    );
    const peCourses = courses
      .filter((course) => course.courseType === "PE")
      .sort((a, b) => a.code.localeCompare(b.code));
    const oeCourses = courses
      .filter((course) => course.courseType === "OE")
      .sort((a, b) => a.code.localeCompare(b.code));

    if (peCourses.length > 0) await occupancy.ensurePeCourses(peCourses);
    if (oeCourses.length > 0) await occupancy.ensureOeBatches(oeCourses);

    const oeCourseIds = oeCourses.map((course) => course.id);
    const [registrations, assignments] = await Promise.all([
      db.courseRegistration.findMany({
        where: {
          studentId: { in: cohort.students.map((student) => student.id) },
          academicTermId: cohort.academicTermId,
          courseId: { in: courses.map((course) => course.id) },
          // No status filter on purpose: the unique constraint
          // [studentId, courseId, academicTermId, registrationType] includes
          // cancelled/superseded rows, so any prior REGULAR row blocks a new
          // insert (mirrors the production "already completed" pre-check).
          registrationType: "REGULAR",
        },
        select: { studentId: true, courseId: true },
      }),
      oeCourseIds.length > 0
        ? db.electiveStudentAssignment.findMany({
            where: {
              studentId: { in: cohort.students.map((student) => student.id) },
              courseId: { in: oeCourseIds },
            },
            select: {
              studentId: true,
              courseId: true,
              electiveBatchId: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const registeredByStudent = new Map<string, Set<string>>();
    for (const reg of registrations) {
      let set = registeredByStudent.get(reg.studentId);
      if (!set) {
        set = new Set<string>();
        registeredByStudent.set(reg.studentId, set);
      }
      set.add(reg.courseId);
    }
    const assignmentsByStudent = new Map<
      string,
      { courseId: string; batchId: string }[]
    >();
    for (const assignment of assignments) {
      const list = assignmentsByStudent.get(assignment.studentId);
      const entry = {
        courseId: assignment.courseId,
        batchId: assignment.electiveBatchId,
      };
      if (list) list.push(entry);
      else assignmentsByStudent.set(assignment.studentId, [entry]);
    }

    const peIds = new Set(peCourses.map((course) => course.id));
    const oeIds = new Set(oeCourseIds);

    if (peIds.size === 0) {
      warnings.push(
        `Cohort ${cohort.key}: no APPROVED PE courses offered — PE step skipped for ${cohort.students.length} student(s)`
      );
    }
    if (oeIds.size === 0) {
      warnings.push(
        `Cohort ${cohort.key}: no APPROVED OE courses offered — OE step skipped for ${cohort.students.length} student(s)`
      );
    }

    const plans: StudentPlan[] = [];
    let cohortFullyRegistered = 0;

    for (const student of cohort.students) {
      const registered =
        registeredByStudent.get(student.id) ?? new Set<string>();
      const plan: StudentPlan = {
        student,
        coreCourseIds: [],
      };

      for (const course of coreCourses) {
        if (!registered.has(course.id)) plan.coreCourseIds.push(course.id);
      }

      if (peIds.size > 0 && ![...peIds].some((id) => registered.has(id))) {
        let assignedPe: CourseRow | undefined;
        for (let attempt = 0; attempt < peCourses.length; attempt++) {
          const candidate =
            peCourses[(roundRobinIndex + attempt) % peCourses.length];
          if (!candidate) continue;
          const capacity = occupancy.peCapacity.get(candidate.id) ?? 0;
          const taken = occupancy.peTaken.get(candidate.id) ?? 0;
          if (taken < capacity) {
            assignedPe = candidate;
            break;
          }
        }
        if (assignedPe) {
          roundRobinIndex += 1;
          occupancy.peTaken.set(
            assignedPe.id,
            (occupancy.peTaken.get(assignedPe.id) ?? 0) + 1
          );
          plan.peCourseId = assignedPe.id;
        } else {
          warnings.push(
            `Student ${student.usn}: all PE courses are at capacity — PE registration skipped`
          );
        }
      }

      if (oeIds.size > 0 && ![...oeIds].some((id) => registered.has(id))) {
        const existing = assignmentsByStudent
          .get(student.id)
          ?.find((entry) => oeIds.has(entry.courseId));
        if (existing) {
          plan.oe = {
            courseId: existing.courseId,
            batchId: existing.batchId,
            needsAssignment: false,
          };
          bumpCreated(existing.courseId);
        } else {
          const candidates: {
            course: CourseRow;
            batch: { id: string; name: string; sortOrder: number };
            fillRatio: number;
          }[] = [];
          for (const course of oeCourses) {
            if (!isOeVisible(course, student)) continue;
            const capacity = course.studentsPerBatch ?? 0;
            for (const batch of course.electiveBatches) {
              const taken = occupancy.batchTaken.get(batch.id) ?? 0;
              if (taken >= capacity) continue;
              candidates.push({
                course,
                batch,
                fillRatio:
                  capacity > 0 ? taken / capacity : Number.POSITIVE_INFINITY,
              });
            }
          }
          candidates.sort(
            (a, b) =>
              a.fillRatio - b.fillRatio ||
              a.course.code.localeCompare(b.course.code) ||
              a.batch.sortOrder - b.batch.sortOrder
          );
          const choice = candidates[0];
          if (choice) {
            occupancy.batchTaken.set(
              choice.batch.id,
              (occupancy.batchTaken.get(choice.batch.id) ?? 0) + 1
            );
            plan.oe = {
              courseId: choice.course.id,
              batchId: choice.batch.id,
              needsAssignment: true,
            };
            bumpCreated(choice.course.id);
          } else {
            warnings.push(
              `Student ${student.usn}: no seats left in any visible OE batch — OE registration skipped`
            );
          }
        }
      }

      const hasAnyRegistration =
        plan.coreCourseIds.length > 0 ||
        plan.peCourseId !== undefined ||
        plan.oe !== undefined;
      if (!hasAnyRegistration) {
        cohortFullyRegistered += 1;
        fullyRegisteredStudents += 1;
        continue;
      }
      plans.push(plan);
      coreRegsCreated += plan.coreCourseIds.length;
      for (const courseId of plan.coreCourseIds) bumpCreated(courseId);
      if (plan.peCourseId) {
        peRegsCreated += 1;
        bumpCreated(plan.peCourseId);
      }
      if (plan.oe) oeRegsCreated += 1;

      if (args.dryRun) {
        const parts: string[] = [`core x${plan.coreCourseIds.length}`];
        if (plan.peCourseId) {
          const label = occupancy.courseLabels.get(plan.peCourseId)?.code;
          parts.push(`PE=${label ?? plan.peCourseId}`);
        }
        if (plan.oe) {
          const label = plan.oe.batchId
            ? occupancy.batchInfo.get(plan.oe.batchId)?.name
            : undefined;
          parts.push(
            `OE=${label ?? plan.oe.courseId}${plan.oe.needsAssignment ? "" : " (existing assignment)"}`
          );
        }
        logger.info(`[dry-run] ${student.usn}: ${parts.join(", ")}`);
      }
    }

    if (plans.length === 0) {
      logger.info(
        `Cohort ${cohort.key}: nothing to do (${cohortFullyRegistered} already fully registered)`
      );
      continue;
    }

    if (args.dryRun) {
      logger.info(
        `[dry-run] Cohort ${cohort.key}: would create ${plans.reduce((sum, plan) => sum + plan.coreCourseIds.length + (plan.peCourseId ? 1 : 0) + (plan.oe ? 1 : 0), 0)} registrations for ${plans.length} student(s)`
      );
      continue;
    }

    const plannedAssignments = plans.filter(
      (plan) => plan.oe?.needsAssignment && plan.oe.batchId
    );
    const plannedAssignmentsPlanned = plannedAssignments.length;

    const txResult = await db.$transaction(async (tx) => {
      const plannedPeIds = Array.from(
        new Set(
          plans
            .map((plan) => plan.peCourseId)
            .filter((id): id is string => Boolean(id))
        )
      ).sort();
      for (const courseId of plannedPeIds) {
        await tx.$queryRaw`SELECT id FROM "Course" WHERE id = ${courseId} FOR UPDATE`;
      }
      for (const courseId of plannedPeIds) {
        const capacity = occupancy.peCapacity.get(courseId) ?? 0;
        const count = await tx.courseRegistration.count({
          where: {
            courseId,
            status: "ACTIVE",
            registrationType: { in: ["REGULAR", "RE_REGISTRATION"] },
          },
        });
        if (count >= capacity) {
          throw new Error(
            `PE course ${occupancy.courseLabels.get(courseId)?.code ?? courseId} filled concurrently (${count}/${capacity})`
          );
        }
      }

      const plannedBatchIds = Array.from(
        new Set(
          plannedAssignments.map((plan) =>
            plan.oe?.needsAssignment && plan.oe.batchId ? plan.oe.batchId : ""
          )
        )
      )
        .filter(Boolean)
        .sort();
      for (const batchId of plannedBatchIds) {
        await tx.$queryRaw`SELECT id FROM "ElectiveBatch" WHERE id = ${batchId} FOR UPDATE`;
      }
      for (const batchId of plannedBatchIds) {
        const info = occupancy.batchInfo.get(batchId);
        const occupied = await tx.electiveStudentAssignment.count({
          where: { electiveBatchId: batchId },
        });
        if (info && occupied >= info.capacity) {
          throw new Error(
            `OE batch ${info.name} filled concurrently (${occupied}/${info.capacity})`
          );
        }
      }

      let assignmentCount = 0;
      if (plannedAssignments.length > 0) {
        const result = await tx.electiveStudentAssignment.createMany({
          data: plannedAssignments.map((plan) => ({
            courseId: plan.oe!.courseId,
            studentId: plan.student.id,
            electiveBatchId: plan.oe!.batchId!,
          })),
          skipDuplicates: true,
        });
        assignmentCount = result.count;
      }

      const registrationResult = await tx.courseRegistration.createMany({
        data: plans.flatMap((plan) =>
          [
            ...plan.coreCourseIds,
            ...(plan.peCourseId ? [plan.peCourseId] : []),
            ...(plan.oe ? [plan.oe.courseId] : []),
          ].map((courseId) => ({
            studentId: plan.student.id,
            courseId,
            semesterId: cohort.semesterId,
            academicTermId: cohort.academicTermId,
          }))
        ),
        skipDuplicates: true,
      });

      // Mirror production submitRegistration: bump electiveMappingVersion for
      // EVERY newly registered batch-managed (PE/OE) course, including OEs
      // where the student already had a batch assignment.
      const batchManagedIds = Array.from(
        new Set([
          ...plannedPeIds,
          ...plans
            .map((plan) => plan.oe?.courseId)
            .filter((id): id is string => Boolean(id)),
        ])
      );
      for (const courseId of batchManagedIds.sort()) {
        await tx.course.update({
          where: { id: courseId },
          data: { electiveMappingVersion: { increment: 1 } },
        });
      }

      return { registrationCount: registrationResult.count, assignmentCount };
    });

    const plannedCount = plans.reduce(
      (sum, plan) =>
        sum +
        plan.coreCourseIds.length +
        (plan.peCourseId ? 1 : 0) +
        (plan.oe ? 1 : 0),
      0
    );
    const createdCount = txResult.registrationCount;
    if (
      createdCount !== plannedCount ||
      txResult.assignmentCount !== plannedAssignmentsPlanned
    ) {
      warnings.push(
        `Cohort ${cohort.key}: skipped ${plannedCount - createdCount} registration(s)/${plannedAssignmentsPlanned - txResult.assignmentCount} assignment(s) due to conflicting rows inserted concurrently`
      );
    }
    logger.info(
      `Cohort ${cohort.key}: registered ${createdCount} courses for ${plans.length} student(s) (${cohortFullyRegistered} already fully registered)`
    );
  }

  logger.info(
    JSON.stringify(
      {
        dryRun: args.dryRun,
        cohorts: sortedCohorts.length,
        studentsProcessed: validStudents.length,
        studentsSkippedIncompleteContext: skippedContext,
        alreadyFullyRegistered: fullyRegisteredStudents,
        coreRegistrations: coreRegsCreated,
        peRegistrations: peRegsCreated,
        oeRegistrations: oeRegsCreated,
        warningCount: warnings.length,
      },
      null,
      2
    )
  );

  if (createdByCourse.size > 0) {
    const lines = Array.from(createdByCourse.entries())
      .map(([courseId, count]) => {
        const label = occupancy.courseLabels.get(courseId);
        return `  ${label ? `${label.code} (${label.courseType})` : courseId}: +${count}`;
      })
      .sort();
    logger.info(`Per-course distribution:\n${lines.join("\n")}`);
  }

  if (warnings.length > 0) {
    logger.warn(
      `${warnings.length} warning(s):\n${warnings.map((w) => `  - ${w}`).join("\n")}`
    );
  }
}

main()
  .catch((error) => {
    logger.error("register-students failed", { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
