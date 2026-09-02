/**
 * declare-see-results.ts — TEMPORARY result-declaration bridge.
 *
 * Declares SEE outcomes for a term's REGULAR / RE_REGISTRATION attempts,
 * mimicking what the COE result-publishing feature will eventually do:
 *
 *   - Only students who were ELIGIBLE to write the SEE get P/F results
 *     (per-course rule from academic-eligibility.service: frozen + mark
 *     eligible + attendance >= 75%).
 *   - SEE-INELIGIBLE students (NE) get outcome NE declared — an outcome
 *     of PENDING would mean "attempt in progress" and lock them out of
 *     re-registration/supplementary forever. NE is what unlocks those.
 *   - Eligible students are split randomly per course: round(n/3) Fail,
 *     the rest Pass (seeded RNG — reproducible across re-runs).
 *   - Fails get a random seeMarks below the course's pass threshold
 *     (weighted near the pass line); passes get [threshold, max].
 *
 * Dry-run by default. Pass --apply to write.
 *
 * Usage (from apps/api):
 *   bun --env-file=../../.env run scripts/declare-see-results.ts \
 *     [--term-type odd] [--term-year 2026] \
 *     [--department CSE] [--semester-number 7] [--program-type UG] \
 *     [--seed 2026] [--apply]
 */
import "dotenv/config";
import { academicEligibility } from "@webcampus/api/src/services/shared/academic-eligibility.service";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";

const SEMESTER_TYPES = ["odd", "even", "supplementary"] as const;
type SemesterTypeValue = (typeof SEMESTER_TYPES)[number];

const PROGRAM_TYPES = ["UG", "PG"] as const;
type ProgramTypeValue = (typeof PROGRAM_TYPES)[number];

const DEFAULT_TERM_TYPE: SemesterTypeValue = "odd";
const DEFAULT_TERM_YEAR = "2026";
const DEFAULT_SEED = 2026;
const FAIL_RATIO = 1 / 3;
const FAIL_MARK_WINDOW = 15; // fails cluster just below the pass line
const FALLBACK_SEE_MAX = 100;
const FALLBACK_SEE_PASS = 40;

interface CliArgs {
  termType: SemesterTypeValue;
  termYear: string;
  department?: string;
  semesterNumber?: number;
  programType?: ProgramTypeValue;
  seed: number;
  apply: boolean;
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

  const rawTermType = read("term-type");
  if (
    rawTermType !== undefined &&
    !SEMESTER_TYPES.includes(rawTermType as SemesterTypeValue)
  ) {
    throw new Error(
      `Invalid --term-type "${rawTermType}". Allowed: ${SEMESTER_TYPES.join(", ")}`
    );
  }
  const rawProgramType = read("program-type");
  if (
    rawProgramType !== undefined &&
    !PROGRAM_TYPES.includes(rawProgramType as ProgramTypeValue)
  ) {
    throw new Error(
      `Invalid --program-type "${rawProgramType}". Allowed: ${PROGRAM_TYPES.join(", ")}`
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
        "Invalid --semester-number. Must be an integer between 1 and 8"
      );
    }
  }
  const rawSeed = read("seed");
  let seed = DEFAULT_SEED;
  if (rawSeed !== undefined) {
    seed = Number(rawSeed);
    if (!Number.isInteger(seed) || seed < 0) {
      throw new Error("Invalid --seed. Must be a non-negative integer");
    }
  }

  return {
    termType: (rawTermType as SemesterTypeValue) ?? DEFAULT_TERM_TYPE,
    termYear: read("term-year") ?? DEFAULT_TERM_YEAR,
    department: read("department"),
    semesterNumber,
    programType: rawProgramType as ProgramTypeValue | undefined,
    seed,
    apply: argv.includes("--apply"),
  };
}

/** Deterministic PRNG — same seed always yields the same assignment. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a style mix of the master seed with a string salt, giving each
 * course its own independent RNG stream. This decouples courses from each
 * other: adding/removing a course (or the DB returning rows in a different
 * order) can never reshuffle another course's P/F assignment.
 */
function deriveCourseSeed(seed: number, salt: string): number {
  let h = (seed >>> 0) ^ 2166136261;
  for (let i = 0; i < salt.length; i++) {
    h ^= salt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const current = copy[i];
    const swapWith = copy[j];
    if (current === undefined || swapWith === undefined) continue;
    copy[i] = swapWith;
    copy[j] = current;
  }
  return copy;
}

function randomIntBetween(rng: () => number, min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

interface CandidateRegistration {
  registrationId: string;
  studentId: string;
  usn: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  seeMaxMarks: number;
  seeEligibility: number;
  registrationType: string;
}

interface CoursePlan {
  courseId: string;
  courseCode: string;
  courseName: string;
  seeMaxMarks: number;
  seeEligibility: number;
  fails: CandidateRegistration[];
  passes: CandidateRegistration[];
  /** Independent RNG stream for this course — also used for mark draws. */
  rng: () => number;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const mode = args.apply ? "APPLY" : "DRY-RUN";

  logger.info(
    `[declare-see-results] mode=${mode} term=${args.termType} ${args.termYear}` +
      ` department=${args.department ?? "(all)"}` +
      ` semester=${args.semesterNumber ?? "(all)"}` +
      ` programType=${args.programType ?? "(all)"} seed=${args.seed}`
  );

  const term = await db.academicTerm.findFirst({
    where: { type: args.termType, year: args.termYear },
    select: { id: true, type: true, year: true },
  });
  if (!term) {
    throw new Error(
      `Academic term "${args.termType} ${args.termYear}" not found`
    );
  }

  const registrations = await db.courseRegistration.findMany({
    where: {
      academicTermId: term.id,
      status: "ACTIVE",
      registrationType: { in: ["REGULAR", "RE_REGISTRATION"] },
      ...(args.department
        ? { student: { departmentName: args.department } }
        : {}),
      ...(args.programType
        ? { student: { programType: args.programType } }
        : {}),
      ...(args.semesterNumber
        ? { semester: { semesterNumber: args.semesterNumber } }
        : {}),
    },
    select: {
      id: true,
      studentId: true,
      courseId: true,
      registrationType: true,
      student: { select: { usn: true } },
      course: {
        select: {
          code: true,
          name: true,
          seeMaxMarks: true,
          seeEligibility: true,
        },
      },
      examRegistrations: {
        // Fetch ALL statuses so CANCELLED rows are counted as skipped too.
        where: { examType: "REGULAR" },
        select: { id: true, status: true, outcome: true },
      },
    },
  });

  if (registrations.length === 0) {
    logger.info(
      "[declare-see-results] No ACTIVE REGULAR/RE_REGISTRATION registrations found for this term/filters. Nothing to do."
    );
    return;
  }

  // ─── Per-course SEE eligibility (system's own rules, incl. freeze) ───
  const studentIds = [...new Set(registrations.map((r) => r.studentId))];
  logger.info(
    `[declare-see-results] Computing per-course eligibility for ${studentIds.length} students...`
  );

  const eligibilityByStudent = new Map<
    string,
    Map<string, { eligible: boolean; reason: string | null }>
  >();
  for (const studentId of studentIds) {
    const eligibility = await academicEligibility.getCourseEligibility(
      studentId,
      term.id
    );
    const byCourseCode = new Map<
      string,
      { eligible: boolean; reason: string | null }
    >();
    for (const course of eligibility?.courses ?? []) {
      byCourseCode.set(course.courseCode, {
        eligible: course.eligible,
        reason: course.reason,
      });
    }
    eligibilityByStudent.set(studentId, byCourseCode);
  }

  // ─── Partition candidates ───
  const candidates: CandidateRegistration[] = [];
  const neCandidates: CandidateRegistration[] = [];
  let skippedAlreadyDeclared = 0;
  const ineligibleReasons: { usn: string; code: string; reason: string }[] = [];

  for (const reg of registrations) {
    const existingExam = reg.examRegistrations[0] ?? null;
    if (
      existingExam &&
      (existingExam.status === "RESULT_DECLARED" ||
        existingExam.status === "CANCELLED")
    ) {
      skippedAlreadyDeclared++;
      continue;
    }

    const candidate = {
      registrationId: reg.id,
      studentId: reg.studentId,
      usn: reg.student.usn,
      courseId: reg.courseId,
      courseCode: reg.course.code,
      courseName: reg.course.name,
      seeMaxMarks: reg.course.seeMaxMarks || FALLBACK_SEE_MAX,
      seeEligibility: reg.course.seeEligibility || FALLBACK_SEE_PASS,
      registrationType: reg.registrationType,
    };

    const eligibility = eligibilityByStudent
      .get(reg.studentId)
      ?.get(reg.course.code);
    if (!eligibility?.eligible) {
      ineligibleReasons.push({
        usn: reg.student.usn,
        code: reg.course.code,
        reason: eligibility?.reason ?? "No eligibility record computed",
      });
      // NOT SEE-eligible → declare NE (not "leave PENDING"): PENDING means
      // attempt-in-progress and blocks every pathway; NE unlocks
      // re-registration / supplementary.
      neCandidates.push(candidate);
      continue;
    }

    candidates.push(candidate);
  }

  // ─── Group by course, then assign outcomes ───
  // Determinism rules:
  //   1. Courses are processed in sorted courseId order and each gets its
  //      own RNG stream derived from (seed, courseId) — no cross-course
  //      coupling regardless of DB row order.
  //   2. Students are sorted by studentId BEFORE shuffling, so the
  //      assignment depends only on (seed, courseId, member set).
  const plans: CoursePlan[] = [];
  const byCourse = new Map<string, CandidateRegistration[]>();
  for (const candidate of candidates) {
    const list = byCourse.get(candidate.courseId) ?? [];
    list.push(candidate);
    byCourse.set(candidate.courseId, list);
  }
  const planEntries = [...byCourse.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );
  for (const [courseId, group] of planEntries) {
    const first = group.at(0);
    if (!first) continue;
    const rng = mulberry32(deriveCourseSeed(args.seed, courseId));
    const stableOrder = [...group].sort((a, b) =>
      a.studentId.localeCompare(b.studentId)
    );
    const shuffled = shuffle(stableOrder, rng);
    const failCount = Math.round(shuffled.length * FAIL_RATIO);
    plans.push({
      courseId,
      courseCode: first.courseCode,
      courseName: first.courseName,
      seeMaxMarks: first.seeMaxMarks,
      seeEligibility: first.seeEligibility,
      fails: shuffled.slice(0, failCount),
      passes: shuffled.slice(failCount),
      rng,
    });
  }
  plans.sort((a, b) => a.courseCode.localeCompare(b.courseCode));

  // ─── Preview ───
  let totalFails = 0;
  let totalPasses = 0;
  logger.info("────────────── DECLARATION PREVIEW ──────────────");
  for (const plan of plans) {
    totalFails += plan.fails.length;
    totalPasses += plan.passes.length;
    logger.info(
      `${plan.courseCode} (${plan.courseName}): ` +
        `${plan.fails.length + plan.passes.length} eligible → ` +
        `${plan.fails.length} F / ${plan.passes.length} P ` +
        `(pass >= ${plan.seeEligibility}, max ${plan.seeMaxMarks})`
    );
    for (const fail of plan.fails) {
      logger.info(`   FAIL  ${fail.usn} (${fail.registrationType})`);
    }
    for (const pass of plan.passes) {
      logger.info(`   PASS  ${pass.usn} (${pass.registrationType})`);
    }
  }
  logger.info("─────────────────────────────────────────────────");
  logger.info(
    `Candidates: ${candidates.length} (${totalFails} F / ${totalPasses} P)`
  );
  logger.info(`NE declarations (NOT SEE-eligible): ${neCandidates.length}`);
  logger.info(
    `Skipped (already declared/cancelled): ${skippedAlreadyDeclared}`
  );
  if (ineligibleReasons.length > 0) {
    const byReason = new Map<string, number>();
    for (const item of ineligibleReasons) {
      byReason.set(item.reason, (byReason.get(item.reason) ?? 0) + 1);
    }
    for (const [reason, count] of byReason) {
      logger.info(`   ${count} × ${reason}`);
    }
  }

  if (!args.apply) {
    logger.info(
      "[declare-see-results] Dry-run complete. Re-run with --apply to commit."
    );
    return;
  }

  // ─── Attempt numbers ───
  // Mirrors academic-rules/attempt-rules.computeAttemptSummary:
  // attempt = max(#non-cancelled course registrations, max exam
  // attemptNumber). Deviation for this bridge: rows belonging to the
  // candidate registrations themselves are excluded, so a first-ever
  // REGULAR SEE is attempt 1 instead of "attempt in progress + 1".
  const candidateRegistrationIds = [...candidates, ...neCandidates].map(
    (c) => c.registrationId
  );
  const affectedCourseIds = [
    ...new Set([...candidates, ...neCandidates].map((c) => c.courseId)),
  ];
  const [priorRegistrations, priorExamRows] = await Promise.all([
    db.courseRegistration.findMany({
      where: {
        studentId: { in: studentIds },
        courseId: { in: affectedCourseIds },
        id: { notIn: candidateRegistrationIds },
        status: { not: "CANCELLED" },
      },
      select: {
        studentId: true,
        courseId: true,
        status: true,
        registrationType: true,
      },
    }),
    db.examRegistration.findMany({
      where: {
        studentId: { in: studentIds },
        courseId: { in: affectedCourseIds },
        sourceCourseRegistrationId: { notIn: candidateRegistrationIds },
        status: { not: "CANCELLED" },
      },
      select: { studentId: true, courseId: true, attemptNumber: true },
    }),
  ]);
  const attemptsByPair = new Map<string, number>();
  for (const reg of priorRegistrations) {
    const key = `${reg.studentId}:${reg.courseId}`;
    attemptsByPair.set(key, (attemptsByPair.get(key) ?? 0) + 1);
  }
  for (const exam of priorExamRows) {
    const key = `${exam.studentId}:${exam.courseId}`;
    attemptsByPair.set(
      key,
      Math.max(attemptsByPair.get(key) ?? 0, exam.attemptNumber)
    );
  }

  // ─── Commit ───
  let written = 0;
  await db.$transaction(async (tx) => {
    for (const plan of plans) {
      const declarations: {
        candidate: CandidateRegistration;
        outcome: "P" | "F";
      }[] = [
        ...plan.fails.map((candidate) => ({
          candidate,
          outcome: "F" as const,
        })),
        ...plan.passes.map((candidate) => ({
          candidate,
          outcome: "P" as const,
        })),
      ];
      for (const { candidate, outcome } of declarations) {
        const maxSee = plan.seeMaxMarks;
        const threshold = Math.min(plan.seeEligibility, maxSee);
        // NOTE: `|| FALLBACK` intentionally treats seeMaxMarks=0 (unconfigured)
        // as absent; the candidate filtering earlier already applied it.
        const seeMarks =
          outcome === "F"
            ? randomIntBetween(
                plan.rng,
                Math.max(0, threshold - FAIL_MARK_WINDOW),
                threshold - 1
              )
            : randomIntBetween(plan.rng, threshold, maxSee);

        const attemptNumber = Math.max(
          1,
          attemptsByPair.get(`${candidate.studentId}:${candidate.courseId}`) ??
            0
        );

        await tx.examRegistration.upsert({
          where: {
            studentId_courseId_academicTermId_examType: {
              studentId: candidate.studentId,
              courseId: candidate.courseId,
              academicTermId: term.id,
              examType: "REGULAR",
            },
          },
          create: {
            studentId: candidate.studentId,
            courseId: candidate.courseId,
            academicTermId: term.id,
            sourceCourseRegistrationId: candidate.registrationId,
            examType: "REGULAR",
            attemptNumber,
            status: "RESULT_DECLARED",
            eligibleAtRegistration: true,
            seeMarks,
            maxSeeMarks: maxSee,
            outcome,
          },
          update: {
            status: "RESULT_DECLARED",
            outcome,
            seeMarks,
            maxSeeMarks: maxSee,
            attemptNumber,
            sourceCourseRegistrationId: candidate.registrationId,
            eligibleAtRegistration: true,
          },
        });
        written++;
      }
    }

    // NE declarations: the student did not sit the SEE (ineligible) —
    // seeMarks stays null and eligibleAtRegistration is false.
    for (const candidate of neCandidates) {
      const attemptNumber = Math.max(
        1,
        attemptsByPair.get(`${candidate.studentId}:${candidate.courseId}`) ?? 0
      );

      await tx.examRegistration.upsert({
        where: {
          studentId_courseId_academicTermId_examType: {
            studentId: candidate.studentId,
            courseId: candidate.courseId,
            academicTermId: term.id,
            examType: "REGULAR",
          },
        },
        create: {
          studentId: candidate.studentId,
          courseId: candidate.courseId,
          academicTermId: term.id,
          sourceCourseRegistrationId: candidate.registrationId,
          examType: "REGULAR",
          attemptNumber,
          status: "RESULT_DECLARED",
          eligibleAtRegistration: false,
          seeMarks: null,
          maxSeeMarks: candidate.seeMaxMarks,
          outcome: "NE",
        },
        update: {
          status: "RESULT_DECLARED",
          outcome: "NE",
          seeMarks: null,
          maxSeeMarks: candidate.seeMaxMarks,
          attemptNumber,
          sourceCourseRegistrationId: candidate.registrationId,
          eligibleAtRegistration: false,
        },
      });
      written++;
    }
  });

  logger.info(
    `[declare-see-results] Done. Declared ${written} results ` +
      `(${totalFails} F / ${totalPasses} P / ${neCandidates.length} NE) ` +
      `for term ${args.termType} ${args.termYear}. ` +
      `Seed=${args.seed} (rerun reproduces the same assignment).`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    logger.error("[declare-see-results] Failed:", error);
    process.exit(1);
  });
