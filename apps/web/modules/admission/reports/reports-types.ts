import { admissionTypes } from "@webcampus/schemas/constants";
import {
  AdmissionResponse,
  getAdmissionFullName,
} from "../admin/admin-admission-columns";

export type ReportType = "admission" | "cancellation" | "fee";

export type ReportColumn = {
  key: string;
  label: string;
  value: (admission: AdmissionResponse) => string;
};

export type AdmissionReportFilters = {
  academicTerm: string;
  semester: string;
  search: string;
  status: string;
  department: string;
  mode: string;
  categoryClaimed: string;
  categoryAllotted: string;
  quota: string;
  createdFrom: string;
  createdTo: string;
  admissionType: string;
  admissionBasedOn: string;
  hostel: string;
  round: string;
  cancellationStatus: string;
  cancellationReason: string;
  feeStatus: string;
};

export const EMPTY_REPORT_FILTERS: AdmissionReportFilters = {
  academicTerm: "",
  semester: "",
  search: "",
  status: "",
  department: "",
  mode: "",
  categoryClaimed: "",
  categoryAllotted: "",
  quota: "",
  createdFrom: "",
  createdTo: "",
  admissionType: "",
  admissionBasedOn: "",
  hostel: "",
  round: "",
  cancellationStatus: "",
  cancellationReason: "",
  feeStatus: "",
};

export const ADMISSION_BASED_ON_OPTIONS = [
  { label: "Class 12th / PUC", value: "CLASS_12_PUC" },
  { label: "Diploma", value: "DIPLOMA" },
];

export const HOSTEL_OPTIONS = [
  { label: "Yes", value: "true" },
  { label: "No", value: "false" },
];

export const CANCELLATION_STATUS_VALUES = ["ACTIVE", "CANCELLED"] as const;

export const CANCELLATION_REASON_VALUES = [
  "LEAVE_COLLEGE",
  "CHANGE_ADMISSION_MODE",
  "OTHER",
] as const;

export const admissionTypeLabel = (value: string) =>
  admissionTypes.find((type) => type.value === value)?.label ?? value;

export const qualificationLabel = (value: string) =>
  value === "CLASS_12_PUC"
    ? "Class 12th / PUC"
    : value === "DIPLOMA"
      ? "Diploma"
      : value;

export const cancellationReasonLabel = (reason?: string | null) => {
  if (!reason) return "-";
  if (reason.startsWith("OTHER:"))
    return reason.slice("OTHER:".length) || "Other";
  if (reason === "LEAVE_COLLEGE") return "Leave College";
  if (reason === "CHANGE_ADMISSION_MODE") return "Change Admission Mode";
  return reason;
};

export const formatReportDate = (raw: string | Date | null | undefined) => {
  if (!raw) return "-";
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

export const getBaseReportColumns = (
  reportType: ReportType
): ReportColumn[] => {
  const base: ReportColumn[] = [
    {
      key: "name",
      label: "Name",
      value: (admission) => getAdmissionFullName(admission),
    },
    {
      key: "email",
      label: "Email",
      value: (admission) => admission.primaryEmail || "-",
    },
    {
      key: "status",
      label: "Status",
      value: (admission) => admission.status,
    },
  ];

  if (reportType === "fee") {
    base.push(
      {
        key: "feePaid",
        label: "Fee Paid (₹)",
        value: (admission) => formatIndianCurrency(admission.feePaid),
      },
      {
        key: "feeStatus",
        label: "Fee Status",
        value: (admission) => (admission.feeStatus ? "Paid" : "Unpaid"),
      },
      {
        key: "receiptNo",
        label: "Receipt No.",
        value: (admission) => admission.feeReceiptNumber || "-",
      }
    );
  }

  if (reportType === "cancellation") {
    base.push(
      {
        key: "cancellationReason",
        label: "Cancellation Reason",
        value: (admission) =>
          cancellationReasonLabel(admission.cancellation?.reason),
      },
      {
        key: "cancelledOn",
        label: "Cancelled On",
        value: (admission) =>
          formatReportDate(admission.cancellation?.cancelledAt),
      },
      {
        key: "cancellationDetails",
        label: "Cancellation Details",
        value: (admission) => admission.cancellation?.description || "-",
      }
    );
  }

  return base;
};

export type ReportColumnSelection = Record<string, boolean>;

export const getAvailableReportColumns = (): ReportColumn[] => [
  {
    key: "branch",
    label: "Branch",
    value: (admission) => admission.department?.name || "-",
  },
  {
    key: "mode",
    label: "Mode of Admission",
    value: (admission) => admission.modeOfAdmission || "-",
  },
  {
    key: "categoryClaimed",
    label: "Category Claimed",
    value: (admission) => admission.categoryClaimed || "-",
  },
  {
    key: "categoryAllotted",
    label: "Category Allotted",
    value: (admission) => admission.categoryAllotted || "-",
  },
  {
    key: "quota",
    label: "Quota",
    value: (admission) => admission.quota || "-",
  },
  {
    key: "createdAt",
    label: "Date",
    value: (admission) => formatReportDate(admission.createdAt),
  },
  {
    key: "admissionType",
    label: "Admission Type",
    value: (admission) => admissionTypeLabel(admission.admissionType || ""),
  },
  {
    key: "admissionBasedOn",
    label: "Qualification",
    value: (admission) => qualificationLabel(admission.admissionBasedOn || ""),
  },
  {
    key: "hostel",
    label: "Hostel",
    value: (admission) => (admission.hostel ? "Yes" : "No"),
  },
  {
    key: "round",
    label: "Round",
    value: (admission) => admission.counsellingRound || "-",
  },
];

export const createEmptyReportColumnSelection = (): ReportColumnSelection => {
  const selection: ReportColumnSelection = {};
  for (const column of getAvailableReportColumns()) {
    selection[column.key] = false;
  }
  return selection;
};

export const getReportColumns = (
  reportType: ReportType,
  selection: ReportColumnSelection
): ReportColumn[] => [
  ...getBaseReportColumns(reportType),
  ...getAvailableReportColumns().filter((column) => selection[column.key]),
];

export const formatIndianCurrency = (amount: number | null | undefined) => {
  if (amount == null || Number.isNaN(amount)) return "₹0";
  return `₹${amount.toLocaleString("en-IN")}`;
};

export const splitFilterValues = (value?: string): string[] =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const joinValues = (values: string[]) => values.join(", ");

export const cancellationStatusLabel = (status: string) =>
  status === "CANCELLED" ? "Cancelled Admissions" : "Active Admissions";

export const feeStatusLabel = (status: string) =>
  status === "true" ? "Paid" : "Unpaid";

export type FilterSummaryItem = { label: string; value: string };

export type ReportFilterContext = {
  terms: Array<{
    id: string;
    type: string;
    year: string;
    Semester?: Array<{
      id: string;
      programType: string;
      semesterNumber: number;
    }>;
  }>;
  departments: Array<{ id: string; name: string }>;
};

export const buildAppliedFilterSummary = (
  filters: AdmissionReportFilters,
  context: ReportFilterContext
): FilterSummaryItem[] => {
  const items: FilterSummaryItem[] = [];

  const term = context.terms.find((t) => t.id === filters.academicTerm);
  if (term) {
    items.push({
      label: "AT",
      value: `${term.type.toUpperCase()} ${term.year}`,
    });
    const semester = term.Semester?.find((s) => s.id === filters.semester);
    if (semester) {
      items.push({
        label: "SEM",
        value: `${semester.programType} - Semester ${semester.semesterNumber}`,
      });
    }
  }

  const departmentValues = splitFilterValues(filters.department);
  if (departmentValues.length) {
    const departmentLabels = departmentValues.map(
      (id) => context.departments.find((d) => d.id === id)?.name ?? id
    );
    items.push({ label: "DEP", value: joinValues(departmentLabels) });
  }

  if (filters.search) items.push({ label: "Search", value: filters.search });
  if (filters.status)
    items.push({
      label: "Status",
      value: joinValues(splitFilterValues(filters.status)),
    });
  if (filters.mode)
    items.push({
      label: "Mode of Admission",
      value: joinValues(splitFilterValues(filters.mode)),
    });
  if (filters.categoryClaimed)
    items.push({
      label: "Category Claimed",
      value: joinValues(splitFilterValues(filters.categoryClaimed)),
    });
  if (filters.categoryAllotted)
    items.push({
      label: "Category Allotted",
      value: joinValues(splitFilterValues(filters.categoryAllotted)),
    });
  if (filters.quota)
    items.push({
      label: "Quota",
      value: joinValues(splitFilterValues(filters.quota)),
    });

  if (filters.createdFrom || filters.createdTo) {
    const range = [
      filters.createdFrom && formatReportDate(filters.createdFrom),
      filters.createdTo && formatReportDate(filters.createdTo),
    ]
      .filter(Boolean)
      .join(" – ");
    if (range) items.push({ label: "Date", value: range });
  }

  if (filters.admissionType)
    items.push({
      label: "Admission Type",
      value: joinValues(
        splitFilterValues(filters.admissionType).map(admissionTypeLabel)
      ),
    });
  if (filters.admissionBasedOn)
    items.push({
      label: "Qualification",
      value: joinValues(
        splitFilterValues(filters.admissionBasedOn).map(qualificationLabel)
      ),
    });
  if (filters.hostel)
    items.push({
      label: "Hostel",
      value: joinValues(
        splitFilterValues(filters.hostel).map((value) =>
          value === "true" ? "Yes" : "No"
        )
      ),
    });
  if (filters.round)
    items.push({
      label: "Round",
      value: joinValues(splitFilterValues(filters.round)),
    });
  if (filters.cancellationStatus)
    items.push({
      label: "Cancellation Status",
      value: joinValues(
        splitFilterValues(filters.cancellationStatus).map(
          cancellationStatusLabel
        )
      ),
    });
  if (filters.cancellationReason)
    items.push({
      label: "Cancellation Reason",
      value: joinValues(
        splitFilterValues(filters.cancellationReason).map(
          cancellationReasonLabel
        )
      ),
    });
  if (filters.feeStatus)
    items.push({
      label: "Fee Status",
      value: joinValues(
        splitFilterValues(filters.feeStatus).map(feeStatusLabel)
      ),
    });

  return items;
};

export type ReportStat = { label: string; value: string };

export const buildReportStatistics = (
  reportType: ReportType,
  rows: AdmissionResponse[]
): ReportStat[] => {
  const statusCount = (status: AdmissionResponse["status"]) =>
    rows.filter((admission) => admission.status === status).length;

  const stats: ReportStat[] = [
    { label: "No. of Students", value: String(rows.length) },
  ];

  if (reportType === "fee") {
    const paid = rows.filter(
      (admission) => admission.feeStatus === true
    ).length;
    const totalCollected = rows.reduce(
      (sum, admission) => sum + (admission.feePaid ?? 0),
      0
    );
    stats.push({
      label: "Total Fees Collected",
      value: formatIndianCurrency(totalCollected),
    });
    stats.push({ label: "Paid", value: String(paid) });
    stats.push({ label: "Unpaid", value: String(rows.length - paid) });
  }

  if (reportType === "cancellation") {
    const cancelled = statusCount("CANCELLED");
    stats.push({ label: "Cancelled", value: String(cancelled) });
    stats.push({ label: "Active", value: String(rows.length - cancelled) });
  }

  if (reportType === "admission") {
    stats.push({ label: "Approved", value: String(statusCount("APPROVED")) });
    stats.push({
      label: "Pending/Submitted",
      value: String(statusCount("PENDING") + statusCount("SUBMITTED")),
    });
    stats.push({ label: "Rejected", value: String(statusCount("REJECTED")) });
  }

  return stats;
};
