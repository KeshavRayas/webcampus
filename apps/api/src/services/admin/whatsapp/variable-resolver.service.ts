import type { MessageFieldSource } from "@webcampus/schemas/admin";

export type ResolutionContext = {
  studentName: string;
  usn: string;
  departmentName: string;
  sectionName: string;
  semester: number;
  academicYear: string;
  course?: {
    code: string;
    name: string;
  };
  cieNumber?: number;
  cieMarks?: number | null;
  cieMax?: number | null;
  finance?: {
    demand: number;
    paid: number;
    balance: number;
  };
  adHoc?: {
    deadline?: string;
    ptmDate?: string;
    ptmTime?: string;
    ptmVenu?: string;
  };
};

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value)
    ? String(value)
    : String(parseFloat(value.toFixed(2)));
}

export function resolveFieldSource(
  source: MessageFieldSource,
  ctx: ResolutionContext
): string {
  switch (source) {
    case "STUDENT_NAME":
      return ctx.studentName;
    case "USN":
      return ctx.usn;
    case "DEPARTMENT":
      return ctx.departmentName;
    case "SECTION":
      return ctx.sectionName;
    case "SEMESTER":
      return String(ctx.semester);
    case "ACADEMIC_YEAR":
      return ctx.academicYear;
    case "SUBJECT_CODE":
      return ctx.course?.code ?? "";
    case "SUBJECT_NAME":
      return ctx.course?.name ?? "";
    case "CIE_MARKS":
      return formatNumber(ctx.cieMarks);
    case "CIE_MAX":
      return formatNumber(ctx.cieMax);
    case "FEE_DEMAND":
      return formatNumber(ctx.finance?.demand);
    case "AMOUNT_PAID":
      return formatNumber(ctx.finance?.paid);
    case "BALANCE":
      return formatNumber(ctx.finance?.balance);
    case "FEE_AMOUNT":
      return formatNumber(ctx.finance?.demand);
    case "DEADLINE":
      return ctx.adHoc?.deadline ?? "";
    case "PTM_DATE":
      return ctx.adHoc?.ptmDate ?? "";
    case "PTM_TIME":
      return ctx.adHoc?.ptmTime ?? "";
    case "PTM_VENUE":
      return ctx.adHoc?.ptmVenu ?? "";
    default:
      return "";
  }
}

export function renderMessageBody(
  messageBody: string,
  values: Map<MessageFieldSource, string>
): string {
  return messageBody.replace(/\{([a-z_]+)\}/g, (match, token: string) => {
    const normalized = token.toUpperCase() as MessageFieldSource;
    return values.get(normalized) ?? match;
  });
}
