import "dotenv/config";
import { ProjectMappingService } from "@webcampus/api/src/services/department/project-mapping.service";
import {
  isBatchManagedCourse,
  isProjectCourse,
} from "@webcampus/api/src/services/shared/course-kind";
import { logger } from "@webcampus/common/logger";
import { redis } from "@webcampus/common/redis";
import { db } from "@webcampus/db";
import type {
  CourseMappingStatusItemType,
  UpsertCourseMappingType,
} from "@webcampus/schemas/department";

const PROGRAM_TYPES = ["UG", "PG"] as const;
type ProgramTypeValue = (typeof PROGRAM_TYPES)[number];

const SEMESTER_TYPES = ["odd", "even", "supplementary"] as const;
type SemesterTypeValue = (typeof SEMESTER_TYPES)[number];

const CYCLE_TYPES = ["PHYSICS", "CHEMISTRY", "NONE"] as const;
type CycleValue = (typeof CYCLE_TYPES)[number];

const DEFAULT_DEPARTMENT_CODE = "CS";
const DEFAULT_TERM_YEAR = "2026";
const DEFAULT_SEMESTER_NUMBER = 7;
const DEFAULT_BASE_URL = "http://localhost:8080";

const DEFAULT_MAPPER_PASSWORD = "password";

interface CliArgs {
  departmentCode?: string;
  termType: SemesterTypeValue;
  termYear: string;
  programType: ProgramTypeValue;
  semesterNumber: number;
  cycle?: CycleValue;
  baseUrl: string;
  email?: string;
  password?: string;
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

  const rawTermType = read("term-type") ?? "odd";
  if (!SEMESTER_TYPES.includes(rawTermType as SemesterTypeValue)) {
    throw new Error(
      `Invalid --term-type "${rawTermType}". Allowed: ${SEMESTER_TYPES.join(", ")}`
    );
  }

  const rawProgramType = read("program-type") ?? "UG";
  if (!PROGRAM_TYPES.includes(rawProgramType as ProgramTypeValue)) {
    throw new Error(
      `Invalid --program-type "${rawProgramType}". Allowed: ${PROGRAM_TYPES.join(", ")}`
    );
  }

  const rawSemesterNumber = read("semester") ?? String(DEFAULT_SEMESTER_NUMBER);
  const semesterNumber = Number(rawSemesterNumber);
  if (
    !Number.isInteger(semesterNumber) ||
    semesterNumber < 1 ||
    semesterNumber > 8
  ) {
    throw new Error(
      `Invalid --semester "${rawSemesterNumber}". Must be an integer between 1 and 8`
    );
  }

  const rawCycle = read("cycle");
  if (rawCycle !== undefined && !CYCLE_TYPES.includes(rawCycle as CycleValue)) {
    throw new Error(
      `Invalid --cycle "${rawCycle}". Allowed: ${CYCLE_TYPES.join(", ")}`
    );
  }

  return {
    departmentCode: read("department-code"),
    termType: rawTermType as SemesterTypeValue,
    termYear: read("term-year") ?? DEFAULT_TERM_YEAR,
    programType: rawProgramType as ProgramTypeValue,
    semesterNumber,
    cycle: rawCycle as CycleValue | undefined,
    baseUrl: (read("base-url") ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    email: read("email"),
    password: read("password"),
  };
}

interface MappingContext {
  departmentId: string;
  departmentName: string;
  semesterId: string;
  academicYear: string;
  mapperFallbackEmail: string;
}

async function resolveDepartmentCode(args: CliArgs): Promise<string> {
  if (args.departmentCode) {
    if (args.programType === "UG" && args.semesterNumber <= 2) {
      logger.warn(
        `UG semester ${args.semesterNumber} courses live in the First Year (BASIC_SCIENCES) department; mapping as "${args.departmentCode}" will be rejected by the API unless it is a Basic Sciences department.`
      );
    }
    return args.departmentCode;
  }
  if (args.programType === "UG" && args.semesterNumber <= 2) {
    const firstYear = await db.department.findFirst({
      where: { type: "BASIC_SCIENCES" },
      select: { code: true },
    });
    if (!firstYear) {
      throw new Error(
        "No BASIC_SCIENCES department found for UG semesters 1-2. Seed departments first."
      );
    }
    logger.info(
      `UG semester ${args.semesterNumber}: defaulting to First Year department (${firstYear.code})`
    );
    return firstYear.code;
  }
  return DEFAULT_DEPARTMENT_CODE;
}

async function resolveMappingContext(args: CliArgs): Promise<MappingContext> {
  const departmentCode = await resolveDepartmentCode(args);
  const department = await db.department.findUnique({
    where: { code: departmentCode },
    select: { id: true, name: true, user: { select: { email: true } } },
  });
  if (!department) {
    throw new Error(
      `Department with code "${departmentCode}" not found. Seed departments first (bun run seed).`
    );
  }

  const academicTerm = await db.academicTerm.findFirst({
    where: { type: args.termType, year: args.termYear },
    select: { id: true, year: true },
  });
  if (!academicTerm) {
    throw new Error(
      `Academic term ${args.termType} ${args.termYear} not found. Create it first.`
    );
  }

  const semester = await db.semester.findFirst({
    where: {
      academicTermId: academicTerm.id,
      programType: args.programType,
      semesterNumber: args.semesterNumber,
    },
    select: { id: true },
  });
  if (!semester) {
    throw new Error(
      `${args.programType} semester-${args.semesterNumber} not found for term ${args.termType} ${args.termYear}. Run the semester seeding first.`
    );
  }

  return {
    departmentId: department.id,
    departmentName: department.name,
    semesterId: semester.id,
    academicYear: academicTerm.year,
    mapperFallbackEmail: department.user.email,
  };
}

interface MapperCredentials {
  email: string;
  password: string;
}

function resolveMapperCredentials(
  args: CliArgs,
  fallbackEmail: string
): MapperCredentials {
  const email =
    args.email ?? process.env.DEPT_MAPPER_USER_EMAIL ?? fallbackEmail;
  const password =
    args.password ??
    process.env.DEPT_MAPPER_USER_PASSWORD ??
    DEFAULT_MAPPER_PASSWORD;
  return { email, password };
}

function extractSessionCookie(headers: Headers): string {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  const cookies =
    typeof getSetCookie === "function"
      ? getSetCookie.call(headers)
      : ([headers.get("set-cookie")].filter(Boolean) as string[]);
  if (cookies.length === 0) {
    throw new Error("Sign-in succeeded but no session cookie was returned");
  }
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

async function signIn(
  baseUrl: string,
  email: string,
  password: string,
  origin: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Sign-in failed (${response.status}) for ${email}: ${text}. Pass --email/--password or set DEPT_MAPPER_USER_EMAIL/DEPT_MAPPER_USER_PASSWORD.`
    );
  }
  return extractSessionCookie(response.headers);
}

interface ApiEnvelope<T> {
  status: string;
  message: string;
  data: T;
}

async function apiRequest<T>(
  baseUrl: string,
  path: string,
  sessionCookie: string,
  origin: string,
  options: { method: "GET" | "POST" | "PUT"; body?: unknown } = {
    method: "GET",
  }
): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = {
    Cookie: sessionCookie,
    "Content-Type": "application/json",
    Origin: origin,
  };
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `${options.method} ${path} failed (${response.status}): ${text}`
    );
  }
  return (await response.json()) as ApiEnvelope<T>;
}

interface FacultyOption {
  id: string;
  name: string;
  departmentAbbreviation: string;
}

// Lab batch names the course-mapping grid expects for courses with a lab
// component (courseMode INTEGRATED / FINAL_SUMMARY). The upsert API
// auto-creates missing Batch rows from these names.
const LAB_BATCHES = ["L1", "L2", "L3", "L4"] as const;

const hasLabComponent = (courseMode: string): boolean =>
  courseMode === "INTEGRATED" || courseMode === "FINAL_SUMMARY";

class BalancedAllocator {
  private readonly load = new Map<string, number>();

  constructor(private readonly pool: string[]) {
    if (pool.length === 0) {
      throw new Error("Cannot allocate faculty from an empty pool");
    }
    shuffle(pool);
    for (const id of pool) {
      this.load.set(id, 0);
    }
  }

  next(): string {
    let selected: string | undefined;
    let lowestLoad = Number.POSITIVE_INFINITY;
    for (const id of this.pool) {
      const currentLoad = this.load.get(id) ?? 0;
      if (currentLoad < lowestLoad) {
        lowestLoad = currentLoad;
        selected = id;
      }
    }
    if (selected === undefined) {
      throw new Error("Faculty pool is empty");
    }
    this.load.set(selected, lowestLoad + 1);
    return selected;
  }
}

function shuffle<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = items[i] as T;
    items[i] = items[j] as T;
    items[j] = temp;
  }
}

interface MappingOutcome {
  course: CourseMappingStatusItemType;
  ok: boolean;
  skipped: boolean;
  detail: string;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  logger.info(
    `Randomizing faculty mappings for department=${args.departmentCode ?? "auto"} term=${args.termType} ${args.termYear} programType=${args.programType} semester=${args.semesterNumber}${args.cycle ? ` cycle=${args.cycle}` : ""} api=${args.baseUrl}`
  );

  const context = await resolveMappingContext(args);
  const credentials = resolveMapperCredentials(
    args,
    context.mapperFallbackEmail
  );

  const origin = process.env.FRONTEND_URL ?? args.baseUrl;
  const sessionCookie = await signIn(
    args.baseUrl,
    credentials.email,
    credentials.password,
    origin
  );
  logger.info(`Signed in as ${credentials.email}`);

  const cycleQuery =
    args.cycle && args.cycle !== "NONE"
      ? `&cycle=${encodeURIComponent(args.cycle)}`
      : "";
  const statusResponse = (
    await apiRequest<{
      departmentId: string;
      departmentName: string;
      courses: CourseMappingStatusItemType[];
    }>(
      args.baseUrl,
      `/department/course-assignment/status?semesterId=${context.semesterId}&academicYear=${encodeURIComponent(context.academicYear)}${cycleQuery}`,
      sessionCookie,
      origin
    )
  ).data;

  const sectionsResponse = await db.section.findMany({
    where: {
      semesterId: context.semesterId,
      departmentId: context.departmentId,
      ...(args.cycle ? { cycle: args.cycle } : {}),
    },
    select: { id: true, name: true, cycle: true },
    orderBy: { name: "asc" },
  });

  const expectedSectionSlots = (
    course: CourseMappingStatusItemType
  ): number | null => {
    if (isBatchManagedCourse(course.courseType)) return null;
    const matched = sectionsResponse.filter(
      (section) => section.cycle === course.cycle
    );
    const withLab = hasLabComponent(course.courseMode);
    return matched.length * (withLab ? 1 + LAB_BATCHES.length : 1);
  };

  const unmappedCourses = statusResponse.courses.filter((course) => {
    if (course.status === "Unmapped") return true;
    const expected = expectedSectionSlots(course);
    return expected !== null && course.assignments.length < expected;
  });
  logger.info(
    `Found ${unmappedCourses.length} course(s) to map (unmapped or partially mapped) out of ${statusResponse.courses.length} in ${statusResponse.departmentName}`
  );
  if (unmappedCourses.length === 0) {
    logger.info("Nothing to map. Exiting.");
    return;
  }

  const facultyResponse = (
    await apiRequest<FacultyOption[]>(
      args.baseUrl,
      "/department/course-assignment/faculty",
      sessionCookie,
      origin
    )
  ).data;
  if (facultyResponse.length === 0) {
    throw new Error(
      `No faculty available in department ${statusResponse.departmentName}. Seed faculties first.`
    );
  }
  const allocator = new BalancedAllocator(facultyResponse.map((f) => f.id));
  const facultyNames = new Map(facultyResponse.map((f) => [f.id, f.name]));
  logger.info(
    `Balancing assignments across ${facultyResponse.length} facult(y/ies)`
  );

  // PW courses created before their sections were generated can end up with
  // zero project groups (group sync only runs on course/section mutations).
  // Reconcile first so faculty can be mapped to freshly created groups.
  const pwIds = unmappedCourses
    .filter((course) => isProjectCourse(course.courseType))
    .map((course) => course.courseId);
  if (pwIds.length > 0) {
    logger.info("Reconciling project groups for PW courses in scope...");
    await db.$transaction(async (tx) => {
      await ProjectMappingService.reconcileProjectGroupsForScope({
        tx,
        departmentId: context.departmentId,
        semesterId: context.semesterId,
      });
    });
  }

  const batchManagedIds = unmappedCourses
    .filter((course) => isBatchManagedCourse(course.courseType))
    .map((course) => course.courseId);

  const electiveBatches =
    batchManagedIds.length > 0
      ? await db.electiveBatch.findMany({
          where: { courseId: { in: batchManagedIds } },
          select: { id: true, courseId: true, name: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      : [];
  const batchesByCourseId = new Map<string, { id: string; name: string }[]>();
  for (const batch of electiveBatches) {
    const existing = batchesByCourseId.get(batch.courseId) ?? [];
    existing.push({ id: batch.id, name: batch.name });
    batchesByCourseId.set(batch.courseId, existing);
  }

  const outcomes: MappingOutcome[] = [];
  let mappedCount = 0;
  let failedCount = 0;

  for (const course of unmappedCourses) {
    try {
      const payload: UpsertCourseMappingType = {
        courseId: course.courseId,
        semesterId: context.semesterId,
        academicYear: context.academicYear,
      };
      const assignedFacultyIds: string[] = [];

      if (isBatchManagedCourse(course.courseType)) {
        const batches = batchesByCourseId.get(course.courseId) ?? [];
        if (batches.length === 0) {
          outcomes.push({
            course,
            ok: false,
            skipped: true,
            detail: isProjectCourse(course.courseType)
              ? "Skipped: no project groups even after reconciliation (are sections created for this semester/cycle?)"
              : "Skipped: no elective batches configured (are elective preferences registered for this semester/cycle?)",
          });
          continue;
        }
        payload.electiveBatchMappings = batches.map((batch) => {
          const facultyId = allocator.next();
          assignedFacultyIds.push(facultyId);
          return { electiveBatchId: batch.id, facultyId };
        });
      } else {
        const matchedSections = sectionsResponse.filter(
          (section) => section.cycle === course.cycle
        );
        if (matchedSections.length === 0) {
          outcomes.push({
            course,
            ok: false,
            skipped: true,
            detail: `Skipped: no sections match cycle ${course.cycle} for this semester/department`,
          });
          continue;
        }
        const withLab = hasLabComponent(course.courseMode);
        payload.sectionMappings = matchedSections.map((section) => {
          const theoryFacultyId = allocator.next();
          assignedFacultyIds.push(theoryFacultyId);
          const labFacultyByBatch = withLab
            ? LAB_BATCHES.map((batchName) => {
                const facultyId = allocator.next();
                assignedFacultyIds.push(facultyId);
                return { batchName, facultyId };
              })
            : [];
          return { sectionId: section.id, theoryFacultyId, labFacultyByBatch };
        });
      }

      await apiRequest(
        args.baseUrl,
        "/department/course-assignment/upsert",
        sessionCookie,
        origin,
        { method: "POST", body: payload }
      );

      const coordinatorIndex = Math.floor(
        Math.random() * assignedFacultyIds.length
      );
      const coordinatorId = assignedFacultyIds[coordinatorIndex];
      if (coordinatorId === undefined) {
        throw new Error(`No faculty assigned for ${course.code}`);
      }
      await apiRequest(
        args.baseUrl,
        `/department/course/${course.courseId}/coordinators`,
        sessionCookie,
        origin,
        { method: "PUT", body: { facultyIds: [coordinatorId] } }
      );

      mappedCount += 1;
      outcomes.push({
        course,
        ok: true,
        skipped: false,
        detail: `${assignedFacultyIds.length} assignment(s), coordinator ${facultyNames.get(coordinatorId)}`,
      });
      logger.info(
        `Mapped ${course.code} - ${course.name}: ${assignedFacultyIds.length} assignment(s), coordinator ${facultyNames.get(coordinatorId)}`
      );
    } catch (error) {
      failedCount += 1;
      const message =
        error instanceof Error
          ? `${error.message}${error.cause ? ` | cause: ${String(error.cause)}` : ""}`
          : String(error);
      outcomes.push({ course, ok: false, skipped: false, detail: message });
      logger.error(`Failed to map ${course.code}: ${message}`);
    }
  }

  const skipped = outcomes.filter((outcome) => outcome.skipped);
  logger.info("========== MAPPING SUMMARY ==========");
  for (const outcome of outcomes) {
    const marker = outcome.ok ? "[OK]  " : "[FAIL]";
    logger.info(
      `${marker} ${outcome.course.code} (${outcome.course.courseType}): ${outcome.detail}`
    );
  }
  logger.info(
    `Done. Mapped: ${mappedCount}, Failed: ${failedCount}, Skipped: ${skipped.length}`
  );
  if (mappedCount === 0 && failedCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    const message =
      error instanceof Error
        ? `${error.message}${error.cause ? ` | cause: ${String(error.cause)}` : ""}`
        : String(error);
    logger.error(`map-faculties failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([redis.quit(), db.$disconnect()]);
  });
