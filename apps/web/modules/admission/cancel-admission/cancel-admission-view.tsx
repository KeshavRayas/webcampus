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
import { admissionTypes } from "@webcampus/schemas/constants";
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
import {
  AdmissionsReportDocument,
  type AdmissionsReportData,
} from "../admin/admissions-report-document";
import { renderNodeToPdf } from "../applicant/admission-pdf";
import { AdmissionFilterBar } from "../shared/admission-filter-bar";
import { cancelAdmissionColumns } from "./cancel-admission-columns";

const ADMISSION_STATUSES = [
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "EXITED",
  "CANCELLED",
] as const;

const CANCELLATION_STATUS_VALUES = ["ALL", "ACTIVE", "CANCELLED"] as const;
const CANCELLATION_REASON_VALUES = [
  "ALL",
  "LEAVE_COLLEGE",
  "CHANGE_ADMISSION_MODE",
  "OTHER",
] as const;
type CancellationStatus = (typeof CANCELLATION_STATUS_VALUES)[number];
type CancellationReason = (typeof CANCELLATION_REASON_VALUES)[number];

type CancelAdmissionFilters = {
  academicTerm: string;
  semester: string;
  applicationId: string;
  status: string;
  mode: string;
  admissionType: string;
  email: string;
  name: string;
  filledBy: string;
  createdFrom: string;
  createdTo: string;
  cancellationStatus: CancellationStatus | "";
  cancellationReason: CancellationReason | "";
};

const EMPTY_FILTERS: CancelAdmissionFilters = {
  academicTerm: "",
  semester: "",
  applicationId: "",
  status: "",
  mode: "",
  admissionType: "",
  email: "",
  name: "",
  filledBy: "",
  createdFrom: "",
  createdTo: "",
  cancellationStatus: "",
  cancellationReason: "",
};

export function CancelAdmissionView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialFilters = getFiltersFromSearchParams(
    searchParams,
    EMPTY_FILTERS
  );
  const [draftFilters, setDraftFilters] =
    useState<CancelAdmissionFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<CancelAdmissionFilters>(initialFilters);

  const [reportData, setReportData] = useState<AdmissionsReportData | null>(
    null
  );
  const reportRef = useRef<HTMLDivElement | null>(null);

  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];
  const { data: departments } = useAdmissionDepartments();

  const { data: admissionConstants } = useAdmissionConstants();
  const admissionModes = admissionConstants?.modes ?? [];
  const selectedTerm = terms.find(
    (term) => term.id === draftFilters.academicTerm
  );
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

  const updateDraftFilter = <K extends keyof CancelAdmissionFilters>(
    key: K,
    value: CancelAdmissionFilters[K]
  ) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const queryFilters = {
    academicTerm: appliedFilters.academicTerm,
    semester: appliedFilters.semester,
    applicationId: appliedFilters.applicationId,
    status: appliedFilters.status,
    mode: appliedFilters.mode,
    admissionType: appliedFilters.admissionType,
    createdFrom: appliedFilters.createdFrom,
    createdTo: appliedFilters.createdTo,
  };
  const query = createFilterQueryString(queryFilters);
  const { data, isFetching, isLoading } = useQuery({
    queryKey: ["cancel-admissions", appliedFilters],
    queryFn: async () => {
      const response = await fetchAdmissions(query);
      return response;
    },
  });

  const filledByOptions = useMemo(() => {
    const byId = new Map<string, { label: string; value: string }>();
    (data ?? []).forEach((admission) => {
      if (admission.filledBy?.id) {
        byId.set(admission.filledBy.id, {
          value: admission.filledBy.id,
          label:
            admission.filledBy.name || admission.filledBy.email || "Unknown",
        });
      }
    });
    return Array.from(byId.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [data]);

  const simpleFilterFields: FilterFieldConfig<CancelAdmissionFilters>[] = [
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

  const advancedFilterFields: FilterFieldConfig<CancelAdmissionFilters>[] = [
    {
      key: "name",
      label: "Name",
      type: "text",
      placeholder: "Search by name",
      inputId: "cancel-name",
    },
    {
      key: "email",
      label: "Email",
      type: "text",
      placeholder: "Search by email",
      inputId: "cancel-email",
    },
    {
      key: "applicationId",
      label: "Application ID",
      type: "text",
      placeholder: "Search application ID",
      inputId: "cancel-application-id",
    },
    {
      key: "filledBy",
      label: "Filled By",
      type: "select",
      placeholder: "All",
      allOptionLabel: "All",
      options: filledByOptions,
    },
    {
      key: "createdFrom",
      label: "Created From",
      type: "date",
      inputId: "cancel-created-from",
      className: "xl:col-start-1",
    },
    {
      key: "createdTo",
      label: "Created To",
      type: "date",
      inputId: "cancel-created-to",
      className: "xl:col-start-2",
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      placeholder: "All statuses",
      allOptionLabel: "All statuses",
      options: ADMISSION_STATUSES.map((status) => ({
        label: status,
        value: status,
      })),
    },
    {
      key: "mode",
      label: "Mode",
      type: "select",
      placeholder: "All modes",
      allOptionLabel: "All modes",
      options: admissionModes.map((mode) => ({ label: mode, value: mode })),
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
      key: "cancellationStatus",
      label: "Cancellation Status",
      type: "select",
      placeholder: "All cancellation statuses",
      allOptionLabel: "All cancellation statuses",
      options: CANCELLATION_STATUS_VALUES.slice(1).map((status) => ({
        label:
          status === "ACTIVE" ? "Active Admissions" : "Cancelled Admissions",
        value: status,
      })),
    },
    {
      key: "cancellationReason",
      label: "Cancellation Reason",
      type: "select",
      placeholder: "All cancellation reasons",
      allOptionLabel: "All cancellation reasons",
      options: CANCELLATION_REASON_VALUES.slice(1).map((reason) => ({
        label:
          reason === "LEAVE_COLLEGE"
            ? "Leave College"
            : reason === "CHANGE_ADMISSION_MODE"
              ? "Change Admission Mode"
              : "Other",
        value: reason,
      })),
    },
  ];

  const filteredAdmissions = useMemo(() => {
    let admissions = data ?? [];

    const email = appliedFilters.email.trim().toLowerCase();
    if (email) {
      admissions = admissions.filter((admission) =>
        admission.primaryEmail.toLowerCase().includes(email)
      );
    }

    const name = appliedFilters.name.trim().toLowerCase();
    if (name) {
      admissions = admissions.filter((admission) =>
        getAdmissionFullName(admission).toLowerCase().includes(name)
      );
    }

    if (appliedFilters.filledBy) {
      admissions = admissions.filter(
        (admission) => admission.filledBy?.id === appliedFilters.filledBy
      );
    }

    if (appliedFilters.cancellationStatus === "ACTIVE") {
      admissions = admissions.filter(
        (admission) => admission.status !== "CANCELLED"
      );
    } else if (appliedFilters.cancellationStatus === "CANCELLED") {
      admissions = admissions.filter(
        (admission) => admission.status === "CANCELLED"
      );
    }

    if (
      appliedFilters.cancellationReason &&
      appliedFilters.cancellationReason !== "ALL"
    ) {
      admissions = admissions.filter((admission) => {
        const reason = admission.cancellation?.reason;
        if (!reason) return false;
        if (appliedFilters.cancellationReason === "OTHER") {
          return reason.startsWith("OTHER:");
        }
        return reason === appliedFilters.cancellationReason;
      });
    }

    return admissions;
  }, [
    appliedFilters.cancellationReason,
    appliedFilters.cancellationStatus,
    appliedFilters.email,
    appliedFilters.name,
    appliedFilters.filledBy,
    data,
  ]);

  const applyFilters = () => {
    if (
      draftFilters.createdFrom &&
      draftFilters.createdTo &&
      new Date(draftFilters.createdFrom) > new Date(draftFilters.createdTo)
    ) {
      toast.error("Created from date must be before created to date.");
      return;
    }

    setAppliedFilters(draftFilters);
    const filterQuery = createFilterQueryString(draftFilters);
    router.replace(`${pathname}${filterQuery ? `?${filterQuery}` : ""}`, {
      scroll: false,
    });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    router.replace(pathname, { scroll: false });
  };

  const generateReportPdf = () => {
    const rows = filteredAdmissions;
    if (rows.length === 0) {
      toast.error("No admissions to include in the report.");
      return;
    }

    const statusCount = (status: AdmissionResponse["status"]) =>
      rows.filter((admission) => admission.status === status).length;

    setReportData({
      generatedAt: new Date().toLocaleString(),
      total: rows.length,
      approved: statusCount("APPROVED"),
      submitted: statusCount("SUBMITTED"),
      pending: statusCount("PENDING") + statusCount("SUBMITTED"),
      rejected: statusCount("REJECTED"),
      rows: rows.map((admission) => ({
        applicationId: admission.applicationId || "-",
        name: getAdmissionFullName(admission),
        email: admission.primaryEmail || "-",
        status: admission.status || "-",
        branch: admission.department?.name || "-",
        mode: admission.modeOfAdmission || "-",
        quota: admission.quota || "-",
        feePaid: admission.feePaid != null ? String(admission.feePaid) : "-",
        receiptNo: admission.feeReceiptNumber || "-",
      })),
    });
  };

  useEffect(() => {
    if (!reportData) return;
    const node = reportRef.current;
    if (!node) return;
    void renderNodeToPdf(
      node,
      `admissions-report-${new Date().toISOString().slice(0, 10)}.pdf`
    )
      .then(() => toast.success("Admissions report PDF downloaded."))
      .catch(() => toast.error("Failed to generate the admissions report PDF."))
      .finally(() => setReportData(null));
  }, [reportData]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading admissions...
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
            dialogDescription="Filter admissions by email, dates, cancellation status, and reason."
            onGenerateReport={generateReportPdf}
            reportButtonLabel="Generate Admissions Report PDF"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Cancel Admission</h1>
            <p className="text-muted-foreground text-sm">
              Review active and cancelled admissions.
            </p>
          </div>
          {isFetching && (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          )}
        </div>

        <DataTable columns={cancelAdmissionColumns} data={filteredAdmissions} />
      </div>

      <div
        className="pointer-events-none absolute left-[-10000px] top-0"
        aria-hidden="true"
      >
        <div ref={reportRef}>
          {reportData ? <AdmissionsReportDocument data={reportData} /> : null}
        </div>
      </div>
    </div>
  );
}

async function fetchAdmissions(query: string): Promise<AdmissionResponse[]> {
  const response = await apiClient.get<BaseResponse<AdmissionResponse[]>>(
    `/admission${query ? `?${query}` : ""}`,
    { withCredentials: true }
  );
  if (response.data.status === "error") {
    throw new Error(response.data.message);
  }
  return response.data.data ?? [];
}
