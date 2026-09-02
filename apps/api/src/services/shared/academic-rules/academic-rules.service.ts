import { db, Prisma } from "@webcampus/db";
import type {
  RegistrationTypeValue,
  RuleWarning,
} from "./academic-rules.types";
import {
  evaluateRegistrationWindow,
  type WindowEvaluation,
} from "./registration-rules";

export type RegistrationWindowQuery = {
  registrationType: RegistrationTypeValue;
  academicTermId: string;
  semesterId: string;
  departmentId?: string | null;
  cycle?: string | null;
};

export async function isRegistrationWindowOpen(
  query: RegistrationWindowQuery,
  options: { now?: Date; tx?: Prisma.TransactionClient } = {}
): Promise<WindowEvaluation & { warnings: RuleWarning[] }> {
  const prisma = options.tx ?? db;

  const windows = await prisma.registrationWindow.findMany({
    where: {
      academicTermId: query.academicTermId,
      semesterId: query.semesterId,
    },
    select: {
      id: true,
      departmentId: true,
      cycle: true,
      registrationType: true,
      isOpen: true,
      startsAt: true,
      endsAt: true,
    },
  });

  return evaluateRegistrationWindow(
    query.registrationType,
    {
      academicTermId: query.academicTermId,
      semesterId: query.semesterId,
      departmentId: query.departmentId ?? null,
      cycle: query.cycle ?? null,
    },
    windows,
    options.now ?? new Date()
  );
}
