/**
 * Pure helpers for the populate-marks-attendance batch writer.
 * Must stay free of @webcampus/db imports so unit tests stay hermetic.
 */

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be >= 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export interface QuestionMarkRow {
  id: string;
  recordId: string;
  questionId: string;
  marksObtained: number;
}

/**
 * Builds one parameterized INSERT ... ON CONFLICT statement for
 * StudentQuestionMark rows. Relies on @@unique([recordId, questionId]) in
 * packages/db/prisma/schema.prisma. Execute with db.$executeRawUnsafe.
 * 4 params per row — keep chunks <= 1000 rows (4000 params << 65535 limit).
 */
export function buildQuestionMarkUpsert(rows: readonly QuestionMarkRow[]): {
  sql: string;
  params: unknown[];
} {
  if (rows.length === 0) {
    throw new Error("buildQuestionMarkUpsert requires at least one row");
  }
  const values: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  for (const row of rows) {
    values.push(
      `($${p++}::text, $${p++}::text, $${p++}::text, $${p++}::float8)`
    );
    params.push(row.id, row.recordId, row.questionId, row.marksObtained);
  }
  const sql = `
    INSERT INTO "StudentQuestionMark" ("id", "recordId", "questionId", "marksObtained")
    SELECT v."id", v."recordId", v."questionId", v."marksObtained"
    FROM (VALUES ${values.join(", ")}) AS v("id", "recordId", "questionId", "marksObtained")
    ON CONFLICT ("recordId", "questionId")
    DO UPDATE SET "marksObtained" = EXCLUDED."marksObtained"
  `;
  return { sql, params };
}
