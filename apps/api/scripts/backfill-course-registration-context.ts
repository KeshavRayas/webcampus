import "dotenv/config";
import { db } from "@webcampus/db";

const PINNED_REGISTRATION_TYPES: string[] = ["REGULAR", "RE_REGISTRATION"];

const apply = process.argv.includes("--apply");

interface RowRef {
  table: string;
  id: string;
  studentId: string;
  courseId: string;
  anchorTermId?: string | null;
}

interface Ambiguity {
  row: RowRef;
  candidateIds: string[];
}

async function loadActiveRegistrations(
  studentId: string,
  courseId: string,
  academicTermId?: string | null
): Promise<{ id: string; academicTermId: string }[]> {
  return db.courseRegistration.findMany({
    where: {
      studentId,
      courseId,
      status: "ACTIVE",
      registrationType: { in: PINNED_REGISTRATION_TYPES as never },
      ...(academicTermId ? { academicTermId } : {}),
    },
    select: { id: true, academicTermId: true },
    orderBy: { registrationDate: "desc" },
  });
}

async function resolveRows(): Promise<{
  resolved: { ref: RowRef; registrationId: string }[];
  ambiguous: Ambiguity[];
  orphan: RowRef[];
}> {
  const resolved: { ref: RowRef; registrationId: string }[] = [];
  const ambiguous: Ambiguity[] = [];
  const orphan: RowRef[] = [];

  // Attendance: batch-scoped aggregates carry no term anchor; only a single
  // active pinned registration is unambiguous.
  const attendanceRows = await db.attendance.findMany({
    where: { courseRegistrationId: null },
    select: { id: true, studentId: true, courseId: true },
  });
  for (const r of attendanceRows) {
    const cands = await loadActiveRegistrations(r.studentId, r.courseId);
    if (cands.length === 1 && cands[0])
      resolved.push({
        ref: { table: "Attendance", ...r },
        registrationId: cands[0].id,
      });
    else if (cands.length === 0) orphan.push({ table: "Attendance", ...r });
    else
      ambiguous.push({
        row: { table: "Attendance", ...r },
        candidateIds: cands.map((c) => c.id),
      });
  }

  // Mark: no term on the row; single active pinned registration only.
  const markRows = await db.mark.findMany({
    where: { courseRegistrationId: null },
    select: { id: true, studentId: true, courseId: true },
  });
  for (const r of markRows) {
    const cands = await loadActiveRegistrations(r.studentId, r.courseId);
    if (cands.length === 1 && cands[0])
      resolved.push({
        ref: { table: "Mark", ...r },
        registrationId: cands[0].id,
      });
    else if (cands.length === 0) orphan.push({ table: "Mark", ...r });
    else
      ambiguous.push({
        row: { table: "Mark", ...r },
        candidateIds: cands.map((c) => c.id),
      });
  }

  // StudentAssessment: term-anchored via assessment template's semester.
  const saRows = await db.studentAssessment.findMany({
    where: { courseRegistrationId: null },
    select: { id: true, studentId: true, courseId: true, assessmentId: true },
  });
  const semesterIds = await db.assessmentTemplate.findMany({
    where: { id: { in: [...new Set(saRows.map((r) => r.assessmentId))] } },
    select: { id: true, semesterId: true },
  });
  const semesterByTemplate = new Map(
    semesterIds.map((s) => [s.id, s.semesterId])
  );
  const semesters = await db.semester.findMany({
    where: { id: { in: [...new Set([...semesterByTemplate.values()])] } },
    select: { id: true, academicTermId: true },
  });
  const termBySemester = new Map(
    semesters.map((s) => [s.id, s.academicTermId])
  );
  for (const r of saRows) {
    const semesterId = semesterByTemplate.get(r.assessmentId);
    const termId = semesterId ? (termBySemester.get(semesterId) ?? null) : null;
    const ref: RowRef = {
      table: "StudentAssessment",
      id: r.id,
      studentId: r.studentId,
      courseId: r.courseId,
      anchorTermId: termId,
    };
    if (!termId) {
      orphan.push(ref);
      continue;
    }
    const cands = await loadActiveRegistrations(
      r.studentId,
      r.courseId,
      termId
    );
    if (cands.length === 1 && cands[0])
      resolved.push({ ref, registrationId: cands[0].id });
    else if (cands.length === 0) orphan.push(ref);
    else ambiguous.push({ row: ref, candidateIds: cands.map((c) => c.id) });
  }

  return { resolved, ambiguous, orphan };
}

async function main() {
  console.log(
    `backfill-course-registration-context: mode=${apply ? "APPLY" : "REPORT"}`
  );
  const { resolved, ambiguous, orphan } = await resolveRows();

  console.log("=== SUMMARY ===");
  console.log(`resolved: ${resolved.length}`);
  console.log(
    `ambiguous (multiple active registrations — manual reconciliation required): ${ambiguous.length}`
  );
  console.log(
    `orphan/unresolvable (no active registration or no derivable term anchor): ${orphan.length}`
  );

  if (ambiguous.length > 0) {
    console.log("=== AMBIGUOUS ROWS ===");
    for (const a of ambiguous) {
      console.log(JSON.stringify({ ...a.row, candidateIds: a.candidateIds }));
    }
  }
  if (orphan.length > 0) {
    console.log("=== ORPHAN ROWS (first 50) ===");
    for (const o of orphan.slice(0, 50)) console.log(JSON.stringify(o));
  }

  if (apply && resolved.length > 0) {
    const byTable = {
      Attendance: resolved.filter((r) => r.ref.table === "Attendance"),
      Mark: resolved.filter((r) => r.ref.table === "Mark"),
      StudentAssessment: resolved.filter(
        (r) => r.ref.table === "StudentAssessment"
      ),
    };
    for (const [table, rows] of Object.entries(byTable)) {
      if (rows.length === 0) continue;
      await db.$transaction(
        rows.map((r) => {
          switch (table) {
            case "Attendance":
              return db.attendance.update({
                where: { id: r.ref.id },
                data: { courseRegistrationId: r.registrationId },
              });
            case "Mark":
              return db.mark.update({
                where: { id: r.ref.id },
                data: { courseRegistrationId: r.registrationId },
              });
            default:
              return db.studentAssessment.update({
                where: { id: r.ref.id },
                data: { courseRegistrationId: r.registrationId },
              });
          }
        })
      );
      console.log(`${table}: updated ${rows.length} rows`);
    }
  }

  console.log(
    apply
      ? "APPLY complete."
      : "REPORT-only run. Re-run with --apply to write pins."
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
