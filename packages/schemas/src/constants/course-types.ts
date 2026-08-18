export const COURSE_TYPES = [
  "PC",
  "PE",
  "OE",
  "NCMC",
  "CC",
  "MJE",
  "MNE",
  "P",
  "PW",
  "SR",
  "NT",
  "BS",
  "ES",
  "AE",
  "HS",
  "MG",
  "GC",
  "AM",
  "ASC1",
  "ASC2",
  "ESC1",
  "PLC",
  "SDC",
  "ETC",
] as const;

export type CourseType = (typeof COURSE_TYPES)[number];

export const PROJECT_GROUPING_SCOPES = [
  "WITHIN_SECTION",
  "DEPARTMENT_WIDE",
] as const;

export type ProjectGroupingScope = (typeof PROJECT_GROUPING_SCOPES)[number];

export const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  PC: "Professional Core",
  PE: "Professional Elective",
  OE: "Open Elective",
  NCMC: "Non-Credit Mandatory",
  CC: "Cluster Core",
  MJE: "Major Elective",
  MNE: "Minor Elective",
  P: "Practical",
  PW: "Project / Mini-Project",
  SR: "Seminar",
  NT: "Internship",
  BS: "Basic Science",
  ES: "Engineering Science",
  AE: "Ability Enhancement",
  HS: "Humanities and Social Sciences",
  MG: "Management",
  GC: "Group Core",
  AM: "Applied Mathematics",
  ASC1: "Applied Science Course 1",
  ASC2: "Applied Science Course 2",
  ESC1: "Engineering Science Course 1",
  PLC: "Programming Language Course",
  SDC: "Skill Development Course",
  ETC: "Emerging Technology Course",
};

export const PROJECT_GROUPING_SCOPE_LABELS: Record<
  ProjectGroupingScope,
  string
> = {
  WITHIN_SECTION: "Within Section",
  DEPARTMENT_WIDE: "Department-wide",
};

export const courseTypeLabel = (
  courseType: string | null | undefined
): string =>
  courseType
    ? (COURSE_TYPE_LABELS[courseType as CourseType] ?? courseType)
    : "";
