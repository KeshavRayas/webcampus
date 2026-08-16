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
  name: string;
  email: string;
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
  name: "",
  email: "",
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
        value: (admission) =>
          admission.feePaid != null ? String(admission.feePaid) : "-",
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
      }
    );
  }

  return base;
};

export const getDynamicReportColumns = (
  filters: AdmissionReportFilters
): ReportColumn[] => {
  const columns: ReportColumn[] = [];

  if (filters.department) {
    columns.push({
      key: "branch",
      label: "Branch",
      value: (admission) => admission.department?.name || "-",
    });
  }
  if (filters.mode) {
    columns.push({
      key: "mode",
      label: "Mode of Admission",
      value: (admission) => admission.modeOfAdmission || "-",
    });
  }
  if (filters.categoryClaimed) {
    columns.push({
      key: "categoryClaimed",
      label: "Category Claimed",
      value: (admission) => admission.categoryClaimed || "-",
    });
  }
  if (filters.categoryAllotted) {
    columns.push({
      key: "categoryAllotted",
      label: "Category Allotted",
      value: (admission) => admission.categoryAllotted || "-",
    });
  }
  if (filters.quota) {
    columns.push({
      key: "quota",
      label: "Quota",
      value: (admission) => admission.quota || "-",
    });
  }
  if (filters.createdFrom || filters.createdTo) {
    columns.push({
      key: "createdAt",
      label: "Date",
      value: (admission) => formatReportDate(admission.createdAt),
    });
  }
  if (filters.admissionType) {
    columns.push({
      key: "admissionType",
      label: "Admission Type",
      value: (admission) => admissionTypeLabel(admission.admissionType || ""),
    });
  }
  if (filters.admissionBasedOn) {
    columns.push({
      key: "admissionBasedOn",
      label: "Qualification",
      value: (admission) =>
        qualificationLabel(admission.admissionBasedOn || ""),
    });
  }
  if (filters.hostel) {
    columns.push({
      key: "hostel",
      label: "Hostel",
      value: (admission) => (admission.hostel ? "Yes" : "No"),
    });
  }
  if (filters.round) {
    columns.push({
      key: "round",
      label: "Round",
      value: (admission) => admission.counsellingRound || "-",
    });
  }

  return columns;
};

export const getReportColumns = (
  reportType: ReportType,
  filters: AdmissionReportFilters
): ReportColumn[] => [
  ...getBaseReportColumns(reportType),
  ...getDynamicReportColumns(filters),
];
