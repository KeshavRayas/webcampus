import type {
  MessageCategory,
  MessageFieldSource,
} from "@webcampus/schemas/admin";

export const COMMON_FIELD_SOURCES: MessageFieldSource[] = [
  "STUDENT_NAME",
  "USN",
  "DEPARTMENT",
  "SECTION",
  "SEMESTER",
  "ACADEMIC_YEAR",
];

export const CATEGORY_FIELD_SOURCES: Record<
  MessageCategory,
  MessageFieldSource[]
> = {
  CIE: [
    ...COMMON_FIELD_SOURCES,
    "SUBJECT_CODE",
    "SUBJECT_NAME",
    "CIE_MARKS",
    "CIE_MAX",
    "CIE_NUMBER",
    "CIE_MARKS_DETAILS",
  ],
  BALANCE_FEE: [
    ...COMMON_FIELD_SOURCES,
    "FEE_DEMAND",
    "AMOUNT_PAID",
    "BALANCE",
    "DEADLINE",
  ],
  ANNUAL_FEE: [...COMMON_FIELD_SOURCES, "FEE_AMOUNT", "DEADLINE"],
  PARENT_TEACHER_MEETING: [
    ...COMMON_FIELD_SOURCES,
    "PTM_DATE",
    "PTM_TIME",
    "PTM_VENUE",
  ],
};

export const FIELD_SOURCE_LABELS: Record<MessageFieldSource, string> = {
  STUDENT_NAME: "Student Name",
  USN: "USN",
  DEPARTMENT: "Department",
  SECTION: "Section",
  SEMESTER: "Semester",
  ACADEMIC_YEAR: "Academic Year",
  SUBJECT_CODE: "Subject Code",
  SUBJECT_NAME: "Subject Name",
  CIE_MARKS: "CIE Marks",
  CIE_MAX: "CIE Max Marks",
  CIE_NUMBER: "CIE Number",
  CIE_MARKS_DETAILS: "CIE Marks Details",
  FEE_DEMAND: "Fee Demand",
  AMOUNT_PAID: "Amount Paid",
  BALANCE: "Balance",
  FEE_AMOUNT: "Fee Amount",
  DEADLINE: "Payment Deadline",
  PTM_DATE: "PTM Date",
  PTM_TIME: "PTM Time",
  PTM_VENUE: "PTM Venue",
};

export function getFieldSourcesForCategory(
  category: MessageCategory
): { value: MessageFieldSource; label: string }[] {
  const sources = CATEGORY_FIELD_SOURCES[category];
  return sources.map((value) => ({
    value,
    label: FIELD_SOURCE_LABELS[value],
  }));
}
