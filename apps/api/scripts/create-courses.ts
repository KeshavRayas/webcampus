import "dotenv/config";
import { AdminCourseService } from "@webcampus/api/src/services/admin/course.service";
import { logger } from "@webcampus/common/logger";
import { redis } from "@webcampus/common/redis";
import { db } from "@webcampus/db";
import { CreateCourseSchema } from "@webcampus/schemas/department";

const PROGRAM_TYPES = ["UG", "PG"] as const;
type ProgramTypeValue = (typeof PROGRAM_TYPES)[number];

const SEMESTER_TYPES = ["odd", "even", "supplementary"] as const;
type SemesterTypeValue = (typeof SEMESTER_TYPES)[number];

const CYCLE_TYPES = ["PHYSICS", "CHEMISTRY", "NONE"] as const;
type CycleValue = (typeof CYCLE_TYPES)[number];

const DEFAULT_TERM_YEAR = "2026";
const DEFAULT_SEMESTER_NUMBER = 7;

const COURSE_CODE_MAX_LENGTH = 20;

interface CliArgs {
  departmentCode?: string;
  termType: SemesterTypeValue;
  termYear: string;
  programType: ProgramTypeValue;
  semesterNumber: number;
  cycle?: CycleValue;
  codeSuffix?: string;
}

const TERM_TYPE_MARKERS: Record<SemesterTypeValue, string> = {
  odd: "",
  even: "E",
  supplementary: "SUP",
};

const CYCLE_MARKERS: Partial<Record<CycleValue, string>> = {
  PHYSICS: "P",
  CHEMISTRY: "C",
};

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

  const departmentCode = read("department-code");

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

  const rawSemesterNumber = read("semester") ?? "7";
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
    departmentCode,
    termType: rawTermType as SemesterTypeValue,
    termYear: read("term-year") ?? DEFAULT_TERM_YEAR,
    programType: rawProgramType as ProgramTypeValue,
    semesterNumber,
    cycle: rawCycle as CycleValue | undefined,
    codeSuffix: read("code-suffix"),
  };
}

function resolveCodeSuffix(args: CliArgs): string {
  if (args.codeSuffix !== undefined) {
    return args.codeSuffix;
  }

  const parts: string[] = [];
  const termMarker = TERM_TYPE_MARKERS[args.termType];
  if (termMarker) parts.push(termMarker);
  if (args.termYear !== DEFAULT_TERM_YEAR) {
    parts.push(args.termYear.slice(-2));
  }
  if (args.semesterNumber !== DEFAULT_SEMESTER_NUMBER) {
    parts.push(`S${args.semesterNumber}`);
  }
  if (args.cycle && args.cycle !== "NONE") {
    parts.push(CYCLE_MARKERS[args.cycle]!);
  }

  return parts.length > 0 ? `-${parts.join("")}` : "";
}

const SHARED_MARKS = {
  seeMaxMarks: 50,
  cieMaxMarks: 50,
} as const;

const REGULAR_THEORY_EXAMS = {
  theoryMaxExams: 3,
  theoryMinExams: 2,
  theoryExamMaxMarks: 40,
} as const;

const PROJECT_THEORY_EXAMS = {
  theoryMaxExams: 2,
  theoryMinExams: 2,
  theoryExamMaxMarks: 50,
} as const;

const NON_INTEGRATED_LOCKED_FIELDS = {
  tutorialCredits: 0,
  practicalCredits: 0,
  skillCredits: 0,
  labMaxMarks: 0,
  labEligibility: 0,
  aatMaxMarks: 0,
  aatEligibility: 0,
} as const;

const FINAL_SUMMARY_LOCKED_FIELDS = {
  labMaxMarks: 0,
  labEligibility: 0,
  aatMaxMarks: 0,
  aatEligibility: 0,
} as const;

const ELECTIVE_BATCH_CONFIG = {
  numberOfBatches: 3,
  studentsPerBatch: 20,
} as const;

const COURSE_DEFINITIONS = [
  {
    code: "21CS71I",
    name: "Database Management Systems",
    courseMode: "INTEGRATED",
    courseType: "PC",
    lectureCredits: 3,
    tutorialCredits: 0,
    practicalCredits: 1,
    skillCredits: 0,
    ...REGULAR_THEORY_EXAMS,
    theoryCieContribution: 20,
    labMaxMarks: 25,
    aatMaxMarks: 5,
  },
  {
    code: "21CS72",
    name: "Software Engineering",
    courseMode: "NON_INTEGRATED",
    courseType: "PC",
    lectureCredits: 3,
    ...NON_INTEGRATED_LOCKED_FIELDS,
    ...REGULAR_THEORY_EXAMS,
    theoryCieContribution: 40,
  },
  {
    code: "21CS731",
    name: "Machine Learning",
    courseMode: "NON_INTEGRATED",
    courseType: "PE",
    lectureCredits: 3,
    ...NON_INTEGRATED_LOCKED_FIELDS,
    ...REGULAR_THEORY_EXAMS,
    theoryCieContribution: 40,
    ...ELECTIVE_BATCH_CONFIG,
  },
  {
    code: "21CS732",
    name: "Cloud Computing",
    courseMode: "NON_INTEGRATED",
    courseType: "PE",
    lectureCredits: 3,
    ...NON_INTEGRATED_LOCKED_FIELDS,
    ...REGULAR_THEORY_EXAMS,
    theoryCieContribution: 40,
    ...ELECTIVE_BATCH_CONFIG,
  },
  {
    code: "21OA751",
    name: "Fundamentals of Cyber Security",
    courseMode: "NON_INTEGRATED",
    courseType: "OE",
    lectureCredits: 3,
    ...NON_INTEGRATED_LOCKED_FIELDS,
    ...REGULAR_THEORY_EXAMS,
    theoryCieContribution: 40,
    ...ELECTIVE_BATCH_CONFIG,
    openElectiveEligibility: "ALL",
  },
  {
    code: "21OA752",
    name: "Design Thinking and Innovation",
    courseMode: "NON_INTEGRATED",
    courseType: "OE",
    lectureCredits: 3,
    ...NON_INTEGRATED_LOCKED_FIELDS,
    ...REGULAR_THEORY_EXAMS,
    theoryCieContribution: 40,
    ...ELECTIVE_BATCH_CONFIG,
    openElectiveEligibility: "ALL",
  },
  {
    code: "21OA753",
    name: "Introduction to Data Science",
    courseMode: "NON_INTEGRATED",
    courseType: "OE",
    lectureCredits: 3,
    ...NON_INTEGRATED_LOCKED_FIELDS,
    ...REGULAR_THEORY_EXAMS,
    theoryCieContribution: 40,
    ...ELECTIVE_BATCH_CONFIG,
    openElectiveEligibility: "ALL",
  },
  {
    code: "21PW791",
    name: "Major Project",
    courseMode: "FINAL_SUMMARY",
    courseType: "PW",
    lectureCredits: 0,
    tutorialCredits: 0,
    practicalCredits: 0,
    skillCredits: 4,
    ...FINAL_SUMMARY_LOCKED_FIELDS,
    ...PROJECT_THEORY_EXAMS,
    theoryCieContribution: 50,
    studentsPerBatch: 4,
    projectGroupingScope: "WITHIN_SECTION",
  },
] as const;

interface SeedContext {
  departmentId: string;
  departmentName: string;
  semesterId: string;
  semesterNumber: number;
}

async function resolveSeedContext(args: CliArgs): Promise<SeedContext> {
  let department: { id: string; name: string } | null = null;
  if (args.departmentCode) {
    department = await db.department.findUnique({
      where: { code: args.departmentCode },
      select: { id: true, name: true },
    });
  } else if (args.cycle === "PHYSICS" || args.cycle === "CHEMISTRY") {
    department = await db.department.findFirst({
      where: { type: "BASIC_SCIENCES" },
      select: { id: true, name: true },
    });
  }
  if (!department) {
    throw new Error(
      args.departmentCode
        ? `Department with code "${args.departmentCode}" not found. Seed departments first (bun run seed).`
        : `--cycle ${args.cycle} requires a BASIC_SCIENCES department. Seed departments first (bun run seed).`
    );
  }

  const academicTerm = await db.academicTerm.findFirst({
    where: { type: args.termType, year: args.termYear },
    select: { id: true },
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
    semesterNumber: args.semesterNumber,
  };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  logger.info(
    `Creating courses for department=${args.departmentCode ?? "(auto: BASIC_SCIENCES)"} term=${args.termType} ${args.termYear} programType=${args.programType} semester=${args.semesterNumber}${args.cycle ? ` cycle=${args.cycle}` : ""}`
  );

  const codeSuffix = resolveCodeSuffix(args);
  logger.info(`Using course code suffix "${codeSuffix}"`);

  const context = await resolveSeedContext(args);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const definition of COURSE_DEFINITIONS) {
    const code = `${definition.code}${codeSuffix}`;
    try {
      if (code.length > COURSE_CODE_MAX_LENGTH) {
        throw new Error(
          `Computed course code "${code}" exceeds ${COURSE_CODE_MAX_LENGTH} characters`
        );
      }
      const payload = CreateCourseSchema.parse({
        ...SHARED_MARKS,
        ...context,
        ...definition,
        ...(args.cycle ? { cycle: args.cycle } : {}),
        code,
      });
      const response = await AdminCourseService.create(payload);
      created += 1;
      logger.info(
        `Created course ${payload.code} - ${payload.name} (${response.data?.id ?? "unknown id"})`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "Course code already exists") {
        skipped += 1;
        logger.info(
          `Skipped course ${code} - ${definition.name}: course code already exists`
        );
      } else {
        failed += 1;
        process.exitCode = 1;
        logger.error(`Failed to create course ${code}`, { error });
      }
    }
  }

  logger.info(
    `Course creation complete. Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`
  );
}

main()
  .catch((error) => {
    logger.error("create-courses failed", { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([redis.quit(), db.$disconnect()]);
  });
