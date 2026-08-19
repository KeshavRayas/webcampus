import { State } from "country-state-city";

const parseDate = (value: string): Date | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value?: string | Date | null): string => {
  if (!value) return "";
  const date = typeof value === "string" ? parseDate(value) : value;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const admissionBasedOnLabel = (code?: string | null): string => {
  if (code === "CLASS_12_PUC") return "Class 12th / PUC";
  if (code === "DIPLOMA") return "Diploma";
  return code ?? "";
};

export const semesterLabelOf = (
  semester?: {
    academicTerm?: { type?: string | null; year?: string | null } | null;
  } | null
): string => {
  const type = semester?.academicTerm?.type;
  const year = semester?.academicTerm?.year;
  if (!type || !year) return "";
  return `${type} ${year}`.toUpperCase();
};

export const academicYearLabel = (semesterLabel: string): string => {
  const match = semesterLabel.match(/\b(20\d{2})\b/);
  return match ? `${match[1]}-${Number(match[1]) + 1}` : "";
};

export const yesNo = (value?: boolean | null): string => (value ? "Yes" : "No");

export const stateNameOf = (
  countryCode?: string | null,
  stateValue?: string | null
): string => {
  if (!stateValue) return "";
  const states = State.getStatesOfCountry(countryCode || "IN");
  if (states.length > 0) {
    return states.find((s) => s.isoCode === stateValue)?.name ?? stateValue;
  }
  return stateValue;
};
