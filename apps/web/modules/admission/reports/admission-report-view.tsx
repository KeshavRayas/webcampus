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
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  admissionTypes,
  allQuotas,
  counsellingRounds,
} from "@webcampus/schemas/constants";
import { BaseResponse } from "@webcampus/types/api";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@webcampus/ui/components/dropdown-menu";
import { type FilterFieldConfig } from "@webcampus/ui/components/filter-builder";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { AdmissionResponse } from "../admin/admin-admission-columns";
import { renderNodeToPdf } from "../applicant/admission-pdf";
import { AdmissionFilterBar } from "../shared/admission-filter-bar";
import {
  AdmissionReportsDocument,
  type ReportDocumentData,
} from "./reports-document";
import {
  ADMISSION_BASED_ON_OPTIONS,
  buildAppliedFilterSummary,
  buildReportStatistics,
  CANCELLATION_REASON_VALUES,
  CANCELLATION_STATUS_VALUES,
  cancellationReasonLabel,
  createEmptyReportColumnSelection,
  EMPTY_REPORT_FILTERS,
  formatIndianCurrency,
  getReportColumns,
  HOSTEL_OPTIONS,
  type AdmissionReportFilters,
  type ReportColumnSelection,
  type ReportType,
} from "./reports-types";

const ADMISSION_STATUSES = [
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "EXITED",
  "CANCELLED",
  "PORTED",
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

const ALWAYS_SHOWN_LABELS: Record<ReportType, string> = {
  admission: "Name, Email, and Status are always included.",
  cancellation:
    "Name, Email, Status, Cancellation Reason, and Cancelled On are always included.",
  fee: "Name, Email, Status, Fee Paid, Fee Status, and Receipt No. are always included.",
};

type ReportPage = {
  items: AdmissionResponse[];
  total: number;
};

const REPORT_FETCH_PAGE_SIZE = 500;

const fetchReportRows = async (
  filters: AdmissionReportFilters,
  page: number,
  pageSize: number
): Promise<ReportPage> => {
  const query = createFilterQueryString(filters);
  const response = await apiClient.get<BaseResponse<ReportPage>>(
    `/admission/reports?${query}${query ? "&" : ""}page=${page}&pageSize=${pageSize}`,
    { withCredentials: true }
  );
  if (response.data.status === "error") {
    throw new Error(response.data.message);
  }
  return response.data.data ?? { items: [], total: 0 };
};

const fetchAllReportRows = async (
  filters: AdmissionReportFilters
): Promise<AdmissionResponse[]> => {
  const all: AdmissionResponse[] = [];
  let page = 0;
  while (true) {
    const result = await fetchReportRows(filters, page, REPORT_FETCH_PAGE_SIZE);
    all.push(...result.items);
    if (all.length >= result.total || result.items.length === 0) break;
    page += 1;
  }
  return all;
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

const downloadCSV = (filename: string, rows: string[][]) => {
  const csvContent = rows
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

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
    const totalCollected = rows.reduce(
      (sum, admission) => sum + (admission.feePaid ?? 0),
      0
    );
    return `Total Students: ${rows.length} · Total Fees Collected: ${formatIndianCurrency(totalCollected)} · Paid: ${paid} · Unpaid: ${rows.length - paid}`;
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
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [columnSelection, setColumnSelection] = useState<ReportColumnSelection>(
    () => createEmptyReportColumnSelection()
  );
  const reportRef = useRef<HTMLDivElement | null>(null);
  const generatingRef = useRef(false);

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
      key: "search",
      label: "Search",
      type: "text",
      placeholder: "Search by name or email",
      inputId: "report-search",
    },
    {
      key: "status",
      label: "Status",
      type: "multiselect",
      placeholder: "All statuses",
      options: toOptions(ADMISSION_STATUSES),
    },
    {
      key: "department",
      label: "Department / Branch",
      type: "multiselect",
      placeholder: "All departments",
      columnKey: "branch",
      options: departments.map((department) => ({
        label: department.name,
        value: department.id,
      })),
    },
    {
      key: "mode",
      label: "Mode of Admission",
      type: "multiselect",
      placeholder: "All modes",
      columnKey: "mode",
      options: toOptions(admissionModes),
    },
    {
      key: "categoryClaimed",
      label: "Category Claimed",
      type: "multiselect",
      placeholder: "All categories",
      columnKey: "categoryClaimed",
      options: categoryClaimedOptions,
    },
    {
      key: "categoryAllotted",
      label: "Category Allotted",
      type: "multiselect",
      placeholder: "All categories",
      columnKey: "categoryAllotted",
      options: categoryAllottedOptions,
    },
    {
      key: "quota",
      label: "Quota",
      type: "multiselect",
      placeholder: "All quotas",
      columnKey: "quota",
      options: quotaOptions,
    },
    {
      key: "createdFrom",
      label: "From (Date)",
      type: "date",
      inputId: "report-created-from",
      columnKey: "createdAt",
    },
    {
      key: "createdTo",
      label: "To (Date)",
      type: "date",
      inputId: "report-created-to",
      columnKey: "createdAt",
    },
    {
      key: "admissionType",
      label: "Admission Type",
      type: "multiselect",
      placeholder: "All admission types",
      columnKey: "admissionType",
      options: admissionTypes.map((type) => ({
        label: type.label,
        value: type.value,
      })),
    },
    {
      key: "admissionBasedOn",
      label: "Qualification",
      type: "multiselect",
      placeholder: "All qualifications",
      columnKey: "admissionBasedOn",
      options: ADMISSION_BASED_ON_OPTIONS,
    },
    {
      key: "hostel",
      label: "Hostel",
      type: "multiselect",
      placeholder: "All",
      columnKey: "hostel",
      options: HOSTEL_OPTIONS,
    },
    {
      key: "round",
      label: "Round",
      type: "multiselect",
      placeholder: "All rounds",
      columnKey: "round",
      options: toOptions(counsellingRounds),
    },
    ...(reportType === "cancellation"
      ? ([
          {
            key: "cancellationStatus",
            label: "Cancellation Status",
            type: "multiselect" as const,
            placeholder: "All cancellation statuses",
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
            type: "multiselect" as const,
            placeholder: "All cancellation reasons",
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
            type: "multiselect" as const,
            placeholder: "All fee statuses",
            options: [
              { label: "Paid", value: "true" },
              { label: "Unpaid", value: "false" },
            ],
          },
        ] as FilterFieldConfig<AdmissionReportFilters>[])
      : []),
  ];

  const { data, isFetching, isLoading } = useQuery({
    queryKey: ["admission-reports", reportType, appliedFilters, page, pageSize],
    queryFn: () => fetchReportRows(appliedFilters, page, pageSize),
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;
  const maxPage = Math.max(Math.ceil(total / pageSize) - 1, 0);

  useEffect(() => {
    if (page > maxPage) setPage(maxPage);
  }, [page, maxPage]);

  const rows = data?.items ?? [];

  const filterSummary = useMemo(
    () => buildAppliedFilterSummary(appliedFilters, { terms, departments }),
    [appliedFilters, terms, departments]
  );

  const reportColumns = useMemo(
    () => getReportColumns(reportType, columnSelection),
    [reportType, columnSelection]
  );

  const toggleColumn = (key: string) => {
    setColumnSelection((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

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
    setPage(0);
    const filterQuery = createFilterQueryString(draftFilters);
    router.replace(`${pathname}${filterQuery ? `?${filterQuery}` : ""}`, {
      scroll: false,
    });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_REPORT_FILTERS);
    setAppliedFilters(EMPTY_REPORT_FILTERS);
    setPage(0);
    router.replace(pathname, { scroll: false });
  };

  const generateReportPdf = async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    try {
      const rows = await fetchAllReportRows(appliedFilters);
      if (rows.length === 0) {
        toast.error("No records to include in the report.");
        return;
      }

      const columns = getReportColumns(reportType, columnSelection);

      setReportData({
        title: REPORT_TITLES[reportType],
        generatedAt: new Date().toLocaleString(),
        total: rows.length,
        summary: buildReportSummary(reportType, rows),
        filters: buildAppliedFilterSummary(appliedFilters, {
          terms,
          departments,
        }),
        statistics: buildReportStatistics(reportType, rows),
        columns: columns.map((column) => ({
          key: column.key,
          label: column.label,
        })),
        rows: rows.map((admission) =>
          columns.map((column) => column.value(admission))
        ),
      });
    } catch {
      toast.error("Failed to fetch data for the report.");
    } finally {
      generatingRef.current = false;
    }
  };

  const generateReportExcel = async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    try {
      const rows = await fetchAllReportRows(appliedFilters);
      if (rows.length === 0) {
        toast.error("No records to include in the report.");
        return;
      }

      const columns = getReportColumns(reportType, columnSelection);
      const csvRows: string[][] = [
        [REPORT_TITLES[reportType]],
        [`Generated: ${new Date().toLocaleString()}`],
        [],
        ...buildAppliedFilterSummary(appliedFilters, {
          terms,
          departments,
        }).map((item) => [`${item.label}: ${item.value}`]),
        [],
        ...buildReportStatistics(reportType, rows).map((stat) => [
          `${stat.label}: ${stat.value}`,
        ]),
        [],
        columns.map((column) => column.label),
        ...rows.map((admission) =>
          columns.map((column) => column.value(admission))
        ),
      ];

      downloadCSV(
        `${reportType}-report-${new Date().toISOString().slice(0, 10)}.csv`,
        csvRows
      );
      toast.success(`${REPORT_TITLES[reportType]} Excel downloaded.`);
    } catch {
      toast.error("Failed to fetch data for the report.");
    } finally {
      generatingRef.current = false;
    }
  };

  const generateReportBoth = async () => {
    await generateReportExcel();
    await generateReportPdf();
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
      <div className="admission-surface space-y-6 p-5 shadow-sm sm:p-6">
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
            fieldToggles={columnSelection}
            onToggleField={toggleColumn}
          />
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">
              {REPORT_TITLES[reportType]}
            </h3>
            <p className="text-muted-foreground text-sm">
              Check the box beside a filter to include its column in the report.{" "}
              {ALWAYS_SHOWN_LABELS[reportType]}
            </p>
          </div>
          <div className="admission-report-download flex shrink-0 items-center gap-2">
            {isFetching && (
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="admission-pill border px-4 py-2 text-sm font-semibold"
                >
                  Download
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="admission-theme-dialog min-w-40"
              >
                <DropdownMenuItem
                  disabled
                  className="rounded-full font-semibold"
                >
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void generateReportPdf()}
                  className="rounded-full"
                >
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void generateReportExcel()}
                  className="rounded-full"
                >
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void generateReportBoth()}
                  className="rounded-full"
                >
                  Both
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {filterSummary.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filterSummary.map((item) => (
              <div
                key={item.label}
                className="admission-pill bg-muted px-3 py-1.5 text-sm"
              >
                <span className="text-foreground font-semibold">
                  {item.label}:
                </span>{" "}
                {item.value}
              </div>
            ))}
          </div>
        )}

        <DataTable
          columns={tableColumns}
          data={rows}
          manualPagination
          page={page}
          pageSize={pageSize}
          totalRows={total}
          onPaginationChange={(nextPage, nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(nextPageSize !== pageSize ? 0 : Math.max(nextPage, 0));
          }}
        />
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
