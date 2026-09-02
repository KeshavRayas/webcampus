import type { AcademicTermResponseType } from "@webcampus/schemas/admin";

export type TermBundle = Pick<AcademicTermResponseType, "id" | "type" | "parity" | "year">;
