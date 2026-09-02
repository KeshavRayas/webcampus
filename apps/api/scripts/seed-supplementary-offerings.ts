/**
 * seed-supplementary-offerings.ts — Demand-based supplementary offering recommender.
 *
 * Idempotent helper: recommends (dry-run) or creates ( --apply ) SupplementaryCourseOffering
 * rows for a supplementary AcademicTerm based on backlog demand.
 *
 * Backlog = CourseRegistration WHERE status=ACTIVE AND registrationType IN (REGULAR, RE_REGISTRATION)
 *           with latest ExamRegistration outcome allowing supplementary (NE, W, X-not-eligible)
 *           per registration-rules.canRegisterSupplementaryCourse + deriveLatestOutcome.
 *
 * Filtered to canonical Course rows where approvalStatus==APPROVED and semesterNumber parity
 * matches term.parity (odd→1,3,5,7 / even→2,4,6,8). Term.type must be supplementary.
 *
 * Usage (from apps/api):
 *   bun --env-file=../../.env run tsx scripts/seed-supplementary-offerings.ts \
 *     --termId <uuid> [--departmentId <id>] [--departmentName <name>] [--programType UG|PG] [--dry-run|--apply]
 *   bun --env-file=../../.env run tsx scripts/seed-supplementary-offerings.ts \
 *     --year 2026-27 --parity odd|even [filters] [--apply]
 *
 * Modes: dry-run (default) prints table and exits; --apply creates missing offerings with dedup.
 */
import "dotenv/config";
import { deriveLatestOutcome } from "@webcampus/api/src/services/shared/academic-rules/exam-rules";
import { canRegisterSupplementaryCourse } from "@webcampus/api/src/services/shared/academic-rules/registration-rules";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";

type ParityValue = "odd" | "even";
type ProgramTypeValue = "UG" | "PG";

interface CliArgs {
  termId?: string;
  year?: string;
  parity?: ParityValue;
  departmentId?: string;
  departmentName?: string;
  programType?: ProgramTypeValue;
  apply: boolean;
}

function printHelp(): void {
  console.log(`
seed-supplementary-offerings — demand-based recommender for supplementary offerings

Usage:
  bun --env-file=../../.env run tsx scripts/seed-supplementary-offerings.ts --termId <id> [filters] [--apply]
  bun --env-file=../../.env run tsx scripts/seed-supplementary-offerings.ts --year <year> --parity odd|even [filters] [--apply]

Options:
  --termId <id>            Supplementary AcademicTerm id (preferred)
  --year <year>            Year label e.g. 2026-27 (requires --parity)
  --parity odd|even        Term parity (requires --year, alternative to --termId)
  --departmentId <id>      Limit to department id
  --departmentName <name>  Limit to department name (resolved to id; --departmentId takes precedence)
  --programType UG|PG      Limit to program type
  --apply                  Write missing offerings (default is --dry-run)
  --dry-run                Explicit dry-run (default)
  --help                   Show this help
`);
}

function parseCliArgs(argv: string[]): CliArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const read = (name: string): string | undefined => {
    const idx = argv.indexOf(`--${name}`);
    if (idx === -1) return undefined;
    const val = argv[idx + 1];
    if (val === undefined || val.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }
    return val;
  };

  const termId = read("termId");
  const year = read("year");
  const rawParity = read("parity");
  let parity: ParityValue | undefined;
  if (rawParity !== undefined) {
    if (rawParity !== "odd" && rawParity !== "even") {
      throw new Error(`Invalid --parity "${rawParity}". Allowed: odd, even`);
    }
    parity = rawParity;
  }
  const departmentId = read("departmentId");
  const departmentName = read("departmentName");
  const rawProgramType = read("programType");
  if (
    rawProgramType !== undefined &&
    rawProgramType !== "UG" &&
    rawProgramType !== "PG"
  ) {
    throw new Error(
      `Invalid --programType "${rawProgramType}". Allowed: UG, PG`
    );
  }

  if (!termId && !year) {
    throw new Error("Provide --termId <id> OR --year <year> --parity odd|even");
  }
  if (year && !parity) {
    throw new Error("--year requires --parity odd|even");
  }
  if (termId && year) {
    logger.warn(
      "[seed-supplementary-offerings] Both --termId and --year provided; using --termId"
    );
  }

  return {
    termId,
    year,
    parity,
    departmentId,
    departmentName,
    programType: rawProgramType as ProgramTypeValue | undefined,
    apply: argv.includes("--apply"),
  };
}

function parityOk(
  semesterNumber: number,
  termParity: string | null | undefined
): boolean {
  if (!termParity) return true;
  const expected = termParity === "odd" ? 1 : 0;
  return semesterNumber % 2 === expected;
}

function pad(
  str: string,
  len: number,
  align: "left" | "right" = "left"
): string {
  if (str.length >= len) return str.slice(0, len);
  return align === "right" ? str.padStart(len) : str.padEnd(len);
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const mode = args.apply ? "APPLY" : "DRY-RUN";

  // Resolve department if name provided
  let resolvedDepartmentId: string | undefined = args.departmentId;
  let resolvedDepartmentName: string | undefined;
  if (!resolvedDepartmentId && args.departmentName) {
    const dept = await db.department.findFirst({
      where: { name: args.departmentName },
      select: { id: true, name: true },
    });
    if (!dept)
      throw new Error(`Department not found for name "${args.departmentName}"`);
    resolvedDepartmentId = dept.id;
    resolvedDepartmentName = dept.name;
  }
  if (resolvedDepartmentId && !resolvedDepartmentName) {
    const dept = await db.department.findUnique({
      where: { id: resolvedDepartmentId },
      select: { name: true },
    });
    resolvedDepartmentName = dept?.name ?? resolvedDepartmentId;
  }

  // Resolve term
  let term: {
    id: string;
    type: string;
    parity: string | null;
    year: string;
  } | null = null;
  if (args.termId) {
    term = await db.academicTerm.findUnique({
      where: { id: args.termId },
      select: { id: true, type: true, parity: true, year: true },
    });
    if (!term)
      throw new Error(`AcademicTerm not found for id "${args.termId}"`);
  } else {
    term = await db.academicTerm.findFirst({
      where: { year: args.year!, parity: args.parity!, type: "supplementary" },
      select: { id: true, type: true, parity: true, year: true },
    });
    if (!term)
      throw new Error(
        `Supplementary AcademicTerm not found for year "${args.year}" parity "${args.parity}"`
      );
  }

  if (term.type !== "supplementary") {
    throw new Error(
      `AcademicTerm ${term.id} (${term.type} ${term.year}) is not supplementary — aborting.`
    );
  }

  logger.info(
    `[seed-supplementary-offerings] mode=${mode} term=${term.id} (${term.type} ${term.year} parity=${term.parity ?? "null"})` +
      ` department=${resolvedDepartmentName ?? "(all)"} programType=${args.programType ?? "(all)"}`
  );

  // Existing offerings for this term
  const existingOfferings = await db.supplementaryCourseOffering.findMany({
    where: { academicTermId: term.id },
    select: { courseId: true },
  });
  const offeredSet = new Set(existingOfferings.map((o) => o.courseId));
  logger.info(
    `[seed-supplementary-offerings] Existing offerings for term: ${offeredSet.size}`
  );

  // Fetch backlog registrations
  // Keep query broad; filtering to APPROVED/parity/department/programType happens in JS so table can show parityOk etc.
  const registrations = await db.courseRegistration.findMany({
    where: {
      status: "ACTIVE",
      registrationType: { in: ["REGULAR", "RE_REGISTRATION"] },
    },
    select: {
      id: true,
      studentId: true,
      courseId: true,
      registrationDate: true,
      course: {
        select: {
          id: true,
          code: true,
          name: true,
          courseType: true,
          approvalStatus: true,
          departmentId: true,
          departmentName: true,
          semesterNumber: true,
          semester: { select: { programType: true, semesterNumber: true } },
        },
      },
      semester: { select: { programType: true, semesterNumber: true } },
      examRegistrations: {
        where: { status: { not: "CANCELLED" } },
        select: {
          status: true,
          outcome: true,
          registeredAt: true,
          eligibleAtRegistration: true,
        },
      },
    },
  });

  logger.info(
    `[seed-supplementary-offerings] Fetched ${registrations.length} ACTIVE REGULAR/RE_REGISTRATION registrations`
  );

  // Deduplicate to latest registration per (studentId, courseId) — mirrors student supplementary logic
  const latestByStudentCourse = new Map<
    string,
    (typeof registrations)[number]
  >();
  for (const reg of registrations) {
    const key = `${reg.studentId}:${reg.courseId}`;
    const existing = latestByStudentCourse.get(key);
    if (
      !existing ||
      reg.registrationDate.getTime() > existing.registrationDate.getTime()
    ) {
      latestByStudentCourse.set(key, reg);
    }
  }
  const deduped = [...latestByStudentCourse.values()];
  logger.info(
    `[seed-supplementary-offerings] Deduped to ${deduped.length} distinct student-course pairs`
  );

  interface CourseStats {
    courseId: string;
    code: string;
    courseType: string;
    departmentId: string;
    departmentName: string | null;
    programType: string;
    semesterNumber: number;
    approvalStatus: string;
    backlogCount: number;
    eligibleCount: number;
    parityOk: boolean;
    alreadyOffered: boolean;
    eligibleStudentIds: Set<string>;
  }

  const statsByCourse = new Map<string, CourseStats>();

  for (const reg of deduped) {
    const courseId = reg.courseId;
    let stats = statsByCourse.get(courseId);
    if (!stats) {
      const semNum =
        reg.course.semesterNumber ??
        reg.course.semester?.semesterNumber ??
        reg.semester.semesterNumber;
      const prog = reg.course.semester?.programType ?? reg.semester.programType;
      stats = {
        courseId,
        code: reg.course.code,
        courseType: reg.course.courseType,
        departmentId: reg.course.departmentId,
        departmentName: reg.course.departmentName,
        programType: prog,
        semesterNumber: semNum,
        approvalStatus: reg.course.approvalStatus,
        backlogCount: 0,
        eligibleCount: 0,
        parityOk: parityOk(semNum, term.parity),
        alreadyOffered: offeredSet.has(courseId),
        eligibleStudentIds: new Set<string>(),
      };
      statsByCourse.set(courseId, stats);
    }
    stats.backlogCount++;

    // Eligibility per registration-rules: derive latest outcome and check supplementary pathway
    const examRows = reg.examRegistrations as Array<{
      status: "REGISTERED" | "SEATED" | "RESULT_DECLARED" | "CANCELLED";
      outcome: "PENDING" | "P" | "F" | "NE" | "W" | "I" | "X";
      registeredAt: Date;
      eligibleAtRegistration: boolean;
    }>;
    if (examRows.length === 0) {
      // No declared outcome — treat as PENDING (not eligible)
      continue;
    }
    const latest = deriveLatestOutcome(
      examRows.map((r) => ({
        status: r.status,
        outcome: r.outcome,
        registeredAt: r.registeredAt,
      }))
    );
    // wasEligibleAtRegistration needed for X case — use newest row's flag
    const newestRow = [...examRows]
      .sort((a, b) => a.registeredAt.getTime() - b.registeredAt.getTime())
      .at(-1);
    const wasEligible = newestRow?.eligibleAtRegistration ?? true;
    const outcome = latest.outcome ?? "PENDING";
    const verdict = canRegisterSupplementaryCourse(
      outcome as never,
      wasEligible
    );
    if (verdict.allowed) {
      if (!stats.eligibleStudentIds.has(reg.studentId)) {
        stats.eligibleStudentIds.add(reg.studentId);
        stats.eligibleCount++;
      }
    }
  }

  // Apply optional filters for display/creation (department/programType)
  let filtered = [...statsByCourse.values()];
  if (resolvedDepartmentId) {
    filtered = filtered.filter((s) => s.departmentId === resolvedDepartmentId);
  }
  if (args.programType) {
    filtered = filtered.filter((s) => s.programType === args.programType);
  }

  // Parity: for even/odd term, only recommend parityOk courses; but show all in table
  // Sort by code
  filtered.sort((a, b) => a.code.localeCompare(b.code));

  // Render table
  const header = [
    pad("code", 16),
    pad("courseType", 12),
    pad("sem", 5, "right"),
    pad("dept", 14),
    pad("prog", 5),
    pad("backlog", 8, "right"),
    pad("eligible", 9, "right"),
    pad("offered?", 9),
    pad("parityOk", 9),
    pad("status", 10),
  ].join(" | ");
  const sep = "-".repeat(header.length);
  console.log(sep);
  console.log(header);
  console.log(sep);
  for (const s of filtered) {
    const row = [
      pad(s.code, 16),
      pad(s.courseType, 12),
      pad(String(s.semesterNumber), 5, "right"),
      pad((s.departmentName ?? s.departmentId).slice(0, 14), 14),
      pad(s.programType, 5),
      pad(String(s.backlogCount), 8, "right"),
      pad(String(s.eligibleCount), 9, "right"),
      pad(s.alreadyOffered ? "yes" : "no", 9),
      pad(s.parityOk ? "yes" : "no", 9),
      pad(s.approvalStatus, 10),
    ].join(" | ");
    console.log(row);
  }
  console.log(sep);
  console.log(
    `Courses shown: ${filtered.length} (total distinct courses in backlog: ${statsByCourse.size})`
  );
  const recommendable = filtered.filter(
    (s) =>
      s.approvalStatus === "APPROVED" &&
      s.parityOk &&
      !s.alreadyOffered &&
      s.eligibleCount > 0
  );
  console.log(
    `Recommendable (APPROVED+parityOk+not offered+eligible>0): ${recommendable.length}`
  );
  console.log(
    `Already offered: ${filtered.filter((s) => s.alreadyOffered).length} | parity mismatch: ${filtered.filter((s) => !s.parityOk).length} | not approved: ${filtered.filter((s) => s.approvalStatus !== "APPROVED").length}`
  );

  if (filtered.length === 0) {
    logger.info(
      "[seed-supplementary-offerings] No courses match filters. Nothing to do."
    );
    return;
  }

  if (!args.apply) {
    logger.info(
      "[seed-supplementary-offerings] Dry-run complete. Re-run with --apply to create missing offerings."
    );
    if (recommendable.length > 0) {
      console.log("\nWould create offerings for:");
      for (const s of recommendable)
        console.log(`  ${s.code} — ${s.eligibleCount} eligible`);
    }
    return;
  }

  // --apply: create missing offerings
  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const s of recommendable) {
    // Double-check dedup (idempotent)
    const exists = await db.supplementaryCourseOffering.findUnique({
      where: {
        academicTermId_courseId: {
          academicTermId: term.id,
          courseId: s.courseId,
        },
      },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      continue;
    }
    try {
      await db.supplementaryCourseOffering.create({
        data: { academicTermId: term.id, courseId: s.courseId },
      });
      created++;
      logger.info(
        `[seed-supplementary-offerings] Created offering: ${s.code} (${s.courseId})`
      );
    } catch (error) {
      // Handle unique constraint race
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        skipped++;
        continue;
      }
      failed++;
      logger.error(
        `[seed-supplementary-offerings] Failed to create offering for ${s.code}:`,
        error
      );
    }
  }

  logger.info(
    `[seed-supplementary-offerings] Done. Created=${created} skipped=${skipped} failed=${failed} term=${term.id}`
  );
  if (failed > 0) throw new Error(`${failed} offering(s) failed to create`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    logger.error("[seed-supplementary-offerings] Failed:", error);
    if (error instanceof Error) console.error(error.message);
    process.exit(1);
  });
