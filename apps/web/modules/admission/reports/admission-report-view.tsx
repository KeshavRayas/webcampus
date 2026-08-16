"use client";

import { apiClient } from "@/lib/api-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useAdmissionConstants } from "@/lib/use-admission-constants";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAdmissionDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import {
  admissionTypes,
  allQuotas,
  counsellingRounds,
} from "@webcampus/schemas/constants";
import { BaseResponse } from "@webcampus/types/api";
import { DataTable } from "@webcampus/ui/components/data-table";
import { type FilterFieldConfig } from "@webcampus/ui/components/filter-builder";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  AdmissionResponse,
  getAdmissionFullName,
} from "../admin/admin-admission-columns";
import { renderNodeToPdf } from "../applicant/admission-pdf";
import { AdmissionFilterBar } from "../shared/admission-filter-bar";
import {
  AdmissionReportsDocument,
  type ReportDocumentData,
} from "./reports-document";
import {
  ADMISSION_BASED_ON_OPTIONS,
  CANCELLATION_REASON_VALUES,
  CANCELLATION_STATUS_VALUES,
  cancellationReasonLabel,
  EMPTY_REPORT_FILTERS,
  getReportColumns,
  HOSTEL_OPTIONS,
  type AdmissionReportFilters,
  type ReportType,
} from "./reports-types";

const ADMISSION_STATUSES = [
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "EXITED",
  "CANCELLED",
] as const;

const REPORT_TITLES: Record<ReportType, string> = {
  admission: "Admissions Report",
  cancellation: "Cancellation Report",
  fee: "Fee Report",
};

const REPORT_DIALOG_DESCRIPTIONS: Record<ReportType, string> = {
  admission:
    "Filter by name, email, status, department, mode, category, quota, date range, admission type, qualification, hostel, and round.",
  cancellation:
    "Filter by name, email, status, department, mode, category, quota, date range, and cancellation details.",
  fee: "Filter by name, email, status, department, mode, category, quota, date range, and fee status.",
};

const flattenCategories = (map?: Record<string, string[]>) => {
  const values = new Set<string>();
  if (map) {
    Object.values(map).forEach((list) =>
      list.forEach((value) => values.add(value))
    );
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b));
};

const toOptions = (values: readonly string[]) =>
  values.map((value) => ({ label: value, value }));

const buildReportSummary = (
  reportType: ReportType,
  rows: AdmissionResponse[]
): string => {
  const statusCount = (status: AdmissionResponse["status"]) =>
    rows.filter((admission) => admission.status === status).length;

  if (reportType === "fee") {
    const paid = rows.filter(
      (admission) => admission.feeStatus === true
    ).length;
    return `Paid: ${paid} · Unpaid: ${rows.length - paid}`;
  }

  if (reportType === "cancellation") {
    const cancelled = rows.filter(
      (admission) => admission.status === "CANCELLED"
    ).length;
    return `Cancelled: ${cancelled} · Active: ${rows.length - cancelled}`;
  }

  return `Approved: ${statusCount("APPROVED")} · Pending/Submitted: ${
    statusCount("PENDING") + statusCount("SUBMITTED")
  } · Rejected: ${statusCount("REJECTED")}`;
};

export function AdmissionReportView({
  reportType,
}: {
  reportType: ReportType;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialFilters = getFiltersFromSearchParams(
    searchParams,
    EMPTY_REPORT_FILTERS
  );

  const [draftFilters, setDraftFilters] =
    useState<AdmissionReportFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<AdmissionReportFilters>(initialFilters);
  const [reportData, setReportData] = useState<ReportDocumentData | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const nextFilters = getFiltersFromSearchParams(
      searchParams,
      EMPTY_REPORT_FILTERS
    );
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams]);

  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];
  const { data: departments = [] } = useAdmissionDepartments();
  const { data: admissionConstants } = useAdmissionConstants();
  const admissionModes = admissionConstants?.modes ?? [];

  const selectedTerm = terms.find((t) => t.id === draftFilters.academicTerm);
  const nestedSemesters = selectedTerm?.Semester || [];
  const semesterOptions = nestedSemesters.filter(
    (semester) =>
      (semester.programType === "UG" &&
        (semester.semesterNumber === 1 || semester.semesterNumber === 3)) ||
      (semester.programType === "PG" && semester.semesterNumber === 1)
  );

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: semesterOptions,
    departments,
  });

  const categoryClaimedOptions = useMemo(() => {
    const claimed = admissionConstants?.categoriesClaimed;
    const modeCategories = draftFilters.mode
      ? claimed?.[draftFilters.mode]
      : undefined;
    if (modeCategories) return toOptions(modeCategories);
    return toOptions(flattenCategories(claimed));
  }, [draftFilters.mode, admissionConstants]);

  const categoryAllottedOptions = useMemo(() => {
    const allotted = admissionConstants?.categoriesAllotted;
    const modeCategories = draftFilters.mode
      ? allotted?.[draftFilters.mode]
      : undefined;
    if (modeCategories) return toOptions(modeCategories);
    return toOptions(flattenCategories(allotted));
  }, [draftFilters.mode, admissionConstants]);

  const quotaOptions = useMemo(() => {
    const quotas = admissionConstants?.quotas;
    const modeQuotas = draftFilters.mode
      ? quotas?.[draftFilters.mode]
      : undefined;
    if (modeQuotas) return toOptions(modeQuotas);
    return toOptions(allQuotas);
  }, [draftFilters.mode, admissionConstants]);

  const updateDraftFilter = (
    key: Extract<keyof AdmissionReportFilters, string>,
    value: string
  ) => {
    if (key === "academicTerm") {
      setDraftFilters((current) => ({
        ...current,
        academicTerm: value,
        semester: "",
      }));
      return;
    }

    if (key === "mode") {
      setDraftFilters((current) => ({
        ...current,
        mode: value,
        categoryClaimed: "",
        categoryAllotted: "",
        quota: "",
      }));
      return;
    }

    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const simpleFilterFields: FilterFieldConfig<AdmissionReportFilters>[] = [
    {
      key: "academicTerm",
      label: "Academic Term",
      type: "select",
      placeholder: "All terms",
      allOptionLabel: "All terms",
      options: terms.map((term) => ({
        label: `${term.type.toUpperCase()} ${term.year}`,
        value: term.id,
      })),
    },
    {
      key: "semester",
      label: "Semester",
      type: "select",
      placeholder: draftFilters.academicTerm
        ? "All semesters"
        : "Select term first",
      allOptionLabel: "All semesters",
      options: semesterOptions.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: semester.id,
      })),
    },
  ];

  const advancedFilterFields: FilterFieldConfig<AdmissionReportFilters>[] = [
    {
      key: "name",
      label: "Name",
      type: "text",
      placeholder: "Search by name",
      inputId: "report-name",
    },
    {
      key: "email",
      label: "Email",
      type: "text",
      placeholder: "Search by email",
      inputId: "report-email",
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      placeholder: "All statuses",
      allOptionLabel: "All statuses",
      options: toOptions(ADMISSION_STATUSES),
    },
    {
      key: "department",
      label: "Department / Branch",
      type: "select",
      placeholder: "All departments",
      allOptionLabel: "All departments",
      options: departments.map((department) => ({
        label: department.name,
        value: department.id,
      })),
    },
    {
      key: "mode",
      label: "Mode of Admission",
      type: "select",
      placeholder: "All modes",
      allOptionLabel: "All modes",
      options: toOptions(admissionModes),
    },
    {
      key: "categoryClaimed",
      label: "Category Claimed",
      type: "select",
      placeholder: "All categories",
      allOptionLabel: "All categories",
      options: categoryClaimedOptions,
    },
    {
      key: "categoryAllotted",
      label: "Category Allotted",
      type: "select",
      placeholder: "All categories",
      allOptionLabel: "All categories",
      options: categoryAllottedOptions,
    },
    {
      key: "quota",
      label: "Quota",
      type: "select",
      placeholder: "All quotas",
      allOptionLabel: "All quotas",
      options: quotaOptions,
    },
    {
      key: "createdFrom",
      label: "From (Date)",
      type: "date",
      inputId: "report-created-from",
    },
    {
      key: "createdTo",
      label: "To (Date)",
      type: "date",
      inputId: "report-created-to",
    },
    {
      key: "admissionType",
      label: "Admission Type",
      type: "select",
      placeholder: "All admission types",
      allOptionLabel: "All admission types",
      options: admissionTypes.map((type) => ({
        label: type.label,
        value: type.value,
      })),
    },
    {
      key: "admissionBasedOn",
      label: "Qualification",
      type: "select",
      placeholder: "All qualifications",
      allOptionLabel: "All qualifications",
      options: ADMISSION_BASED_ON_OPTIONS,
    },
    {
      key: "hostel",
      label: "Hostel",
      type: "select",
      placeholder: "All",
      allOptionLabel: "All",
      options: HOSTEL_OPTIONS,
    },
    {
      key: "round",
      label: "Round",
      type: "select",
      placeholder: "All rounds",
      allOptionLabel: "All rounds",
      options: toOptions(counsellingRounds),
    },
    ...(reportType === "cancellation"
      ? ([
          {
            key: "cancellationStatus",
            label: "Cancellation Status",
            type: "select" as const,
            placeholder: "All cancellation statuses",
            allOptionLabel: "All cancellation statuses",
            options: CANCELLATION_STATUS_VALUES.map((status) => ({
              label:
                status === "ACTIVE"
                  ? "Active Admissions"
                  : "Cancelled Admissions",
              value: status,
            })),
          },
          {
            key: "cancellationReason",
            label: "Cancellation Reason",
            type: "select" as const,
            placeholder: "All cancellation reasons",
            allOptionLabel: "All cancellation reasons",
            options: CANCELLATION_REASON_VALUES.map((reason) => ({
              label: cancellationReasonLabel(reason),
              value: reason,
            })),
          },
        ] as FilterFieldConfig<AdmissionReportFilters>[])
      : []),
    ...(reportType === "fee"
      ? ([
          {
            key: "feeStatus",
            label: "Fee Status",
            type: "select" as const,
            placeholder: "All fee statuses",
            allOptionLabel: "All fee statuses",
            options: [
              { label: "Paid", value: "true" },
              { label: "Unpaid", value: "false" },
            ],
          },
        ] as FilterFieldConfig<AdmissionReportFilters>[])
      : []),
  ];

  const query = createFilterQueryString(appliedFilters);
  const { data, isFetching, isLoading } = useQuery({
    queryKey: ["admission-reports", reportType, appliedFilters],
    queryFn: async () => {
      const response = await apiClient.get<BaseResponse<AdmissionResponse[]>>(
        `/admission${query ? `?${query}` : ""}`,
        { withCredentials: true }
      );
      if (response.data.status === "error") {
        throw new Error(response.data.message);
      }
      return response.data.data ?? [];
    },
  });

  const filteredAdmissions = useMemo(() => {
    let rows = data ?? [];
    const filters = appliedFilters;

    const name = filters.name.trim().toLowerCase();
    if (name) {
      rows = rows.filter((admission) =>
        getAdmissionFullName(admission).toLowerCase().includes(name)
      );
    }

    const email = filters.email.trim().toLowerCase();
    if (email) {
      rows = rows.filter((admission) =>
        admission.primaryEmail?.toLowerCase().includes(email)
      );
    }

    if (filters.status) {
      rows = rows.filter((admission) => admission.status === filters.status);
    }
    if (filters.department) {
      rows = rows.filter(
        (admission) => admission.departmentId === filters.department
      );
    }
    if (filters.mode) {
      rows = rows.filter(
        (admission) =>
          admission.modeOfAdmission?.toLowerCase() ===
          filters.mode.toLowerCase()
      );
    }
    if (filters.categoryClaimed) {
      rows = rows.filter(
        (admission) => admission.categoryClaimed === filters.categoryClaimed
      );
    }
    if (filters.categoryAllotted) {
      rows = rows.filter(
        (admission) => admission.categoryAllotted === filters.categoryAllotted
      );
    }
    if (filters.quota) {
      rows = rows.filter((admission) => admission.quota === filters.quota);
    }
    if (filters.admissionType) {
      rows = rows.filter(
        (admission) => admission.admissionType === filters.admissionType
      );
    }
    if (filters.admissionBasedOn) {
      rows = rows.filter(
        (admission) => admission.admissionBasedOn === filters.admissionBasedOn
      );
    }
    if (filters.hostel) {
      rows = rows.filter((admission) =>
        filters.hostel === "true"
          ? admission.hostel === true
          : admission.hostel !== true
      );
    }
    if (filters.round) {
      rows = rows.filter(
        (admission) => admission.counsellingRound === filters.round
      );
    }

    if (reportType === "cancellation") {
      if (filters.cancellationStatus === "ACTIVE") {
        rows = rows.filter((admission) => admission.status !== "CANCELLED");
      } else if (filters.cancellationStatus === "CANCELLED") {
        rows = rows.filter((admission) => admission.status === "CANCELLED");
      }
      if (filters.cancellationReason) {
        rows = rows.filter((admission) => {
          const reason = admission.cancellation?.reason;
          if (!reason) return false;
          if (filters.cancellationReason === "OTHER") {
            return reason.startsWith("OTHER:");
          }
          return reason === filters.cancellationReason;
        });
      }
    }

    if (reportType === "fee" && filters.feeStatus) {
      rows = rows.filter((admission) =>
        filters.feeStatus === "true"
          ? admission.feeStatus === true
          : admission.feeStatus !== true
      );
    }

    return rows;
  }, [data, appliedFilters, reportType]);

  const reportColumns = useMemo(
    () => getReportColumns(reportType, appliedFilters),
    [reportType, appliedFilters]
  );

  const tableColumns = useMemo(
    () =>
      reportColumns.map((column) => ({
        id: column.key,
        header: column.label,
        cell: ({ row }: { row: { original: AdmissionResponse } }) => (
          <div>{column.value(row.original)}</div>
        ),
      })),
    [reportColumns]
  );

  const applyFilters = () => {
    if (
      draftFilters.createdFrom &&
      draftFilters.createdTo &&
      new Date(draftFilters.createdFrom) > new Date(draftFilters.createdTo)
    ) {
      toast.error("From date must be before To date.");
      return;
    }

    setAppliedFilters(draftFilters);
    const filterQuery = createFilterQueryString(draftFilters);
    router.replace(`${pathname}${filterQuery ? `?${filterQuery}` : ""}`, {
      scroll: false,
    });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_REPORT_FILTERS);
    setAppliedFilters(EMPTY_REPORT_FILTERS);
    router.replace(pathname, { scroll: false });
  };

  const generateReportPdf = () => {
    const rows = filteredAdmissions;
    if (rows.length === 0) {
      toast.error("No records to include in the report.");
      return;
    }

    const columns = getReportColumns(reportType, appliedFilters);

    setReportData({
      title: REPORT_TITLES[reportType],
      generatedAt: new Date().toLocaleString(),
      total: rows.length,
      summary: buildReportSummary(reportType, rows),
      columns: columns.map((column) => ({
        key: column.key,
        label: column.label,
      })),
      rows: rows.map((admission) =>
        columns.map((column) => column.value(admission))
      ),
    });
  };

  useEffect(() => {
    if (!reportData) return;
    const node = reportRef.current;
    if (!node) return;
    void renderNodeToPdf(
      node,
      `${reportType}-report-${new Date().toISOString().slice(0, 10)}.pdf`
    )
      .then(() => toast.success(`${REPORT_TITLES[reportType]} PDF downloaded.`))
      .catch(() => toast.error("Failed to generate the report PDF."))
      .finally(() => setReportData(null));
  }, [reportData, reportType]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading report data...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-card text-card-foreground space-y-6 rounded-lg border p-6 shadow-sm">
        <div className="space-y-4">
          <AdmissionFilterBar
            simpleFields={simpleFilterFields}
            advancedFields={advancedFilterFields}
            draftFilters={draftFilters}
            onDraftChange={updateDraftFilter}
            onApply={applyFilters}
            onReset={resetFilters}
            dialogTitle="Advanced Filters"
            dialogDescription={REPORT_DIALOG_DESCRIPTIONS[reportType]}
            onGenerateReport={generateReportPdf}
            reportButtonLabel={`Generate ${REPORT_TITLES[reportType]} PDF`}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">
              {REPORT_TITLES[reportType]}
            </h3>
            <p className="text-muted-foreground text-sm">
              Columns are injected dynamically based on the advanced filters you
              apply. Name, email, and status are always shown.
            </p>
          </div>
          {isFetching && (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          )}
        </div>

        <DataTable columns={tableColumns} data={filteredAdmissions} />
      </div>

      <div
        className="pointer-events-none absolute left-[-10000px] top-0"
        aria-hidden="true"
      >
        <div ref={reportRef}>
          {reportData ? <AdmissionReportsDocument data={reportData} /> : null}
        </div>
      </div>
    </div>
  );
}
