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
import { renderNodeToPdf } from "../applicant/admission-pdf";
import { AdmissionFilterBar } from "../shared/admission-filter-bar";
import { uploadDocsColumns, UploadDocsResponse } from "./upload-docs-columns";
import {
  UploadDocsReportDocument,
  type UploadDocsReportData,
} from "./upload-docs-report-document";

const ADMISSION_STATUSES = [
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;

type UploadDocumentFilters = {
  academicTerm: string;
  semester: string;
  applicationId: string;
  status: string;
  mode: string;
  admissionType: string;
  email: string;
  createdFrom: string;
  createdTo: string;
};

const EMPTY_FILTERS: UploadDocumentFilters = {
  academicTerm: "",
  semester: "",
  applicationId: "",
  status: "",
  mode: "",
  admissionType: "",
  email: "",
  createdFrom: "",
  createdTo: "",
};

export function UploadDocsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialFilters = getFiltersFromSearchParams(
    searchParams,
    EMPTY_FILTERS
  );

  const [draftFilters, setDraftFilters] =
    useState<UploadDocumentFilters>(initialFilters);

  const [appliedFilters, setAppliedFilters] =
    useState<UploadDocumentFilters>(initialFilters);

  const [reportData, setReportData] = useState<UploadDocsReportData | null>(
    null
  );
  const reportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const nextFilters = getFiltersFromSearchParams(searchParams, EMPTY_FILTERS);

    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams]);

  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];

  const { data: departments = [] } = useAdmissionDepartments();

  const { data: admissionConstants } = useAdmissionConstants();
  const admissionModes = admissionConstants?.modes ?? [];

  const selectedTerm = terms.find(
    (term) => term.id === draftFilters.academicTerm
  );

  const nestedSemesters = selectedTerm?.Semester ?? [];

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: nestedSemesters,
    departments,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["upload-documents", appliedFilters],
    queryFn: async () => {
      const apiFilters: Omit<UploadDocumentFilters, "email"> = {
        ...appliedFilters,
      };
      const query = createFilterQueryString(apiFilters);

      const res = await apiClient.get<BaseResponse<UploadDocsResponse[]>>(
        `/admission${query ? `?${query}` : ""}`,
        {
          withCredentials: true,
        }
      );

      if (res.data.status === "success") {
        return res.data.data;
      }

      return [];
    },
  });

  const filteredDocuments = useMemo(() => {
    const email = appliedFilters.email.trim().toLowerCase();
    if (!email) return data ?? [];
    return (data ?? []).filter((admission) =>
      admission.primaryEmail?.toLowerCase().includes(email)
    );
  }, [data, appliedFilters.email]);

  const updateDraftFilter = (
    key: keyof UploadDocumentFilters,
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

    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const simpleFilterFields: FilterFieldConfig<UploadDocumentFilters>[] = [
    {
      key: "academicTerm",
      label: "Academic Term",
      type: "select",
      placeholder: "All terms",
      allOptionLabel: "All terms",
      options: terms.map((term) => ({
        label: `${term.type} ${term.year}`,
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
      options: nestedSemesters.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: semester.id,
      })),
    },
  ];

  const advancedFilterFields: FilterFieldConfig<UploadDocumentFilters>[] = [
    {
      key: "email",
      label: "Email",
      type: "text",
      inputId: "email",
      placeholder: "Search by email",
    },
    {
      key: "applicationId",
      label: "Application ID",
      type: "text",
      inputId: "applicationId",
      placeholder: "Search application ID",
    },
    {
      key: "createdFrom",
      label: "Created From",
      type: "date",
      inputId: "createdFrom",
    },
    {
      key: "createdTo",
      label: "Created To",
      type: "date",
      inputId: "createdTo",
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
      options: admissionModes.map((mode) => ({
        label: mode,
        value: mode,
      })),
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
  ];

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

    const query = createFilterQueryString(draftFilters);

    router.replace(`${pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);

    router.replace(pathname, {
      scroll: false,
    });
  };

  const countUploadedDocuments = (row: UploadDocsResponse) =>
    [
      row.photo,
      row.aadharCard,
      row.class10thMarksPdf,
      row.class12thMarksPdf,
      row.diplomaMarksPdf,
      row.casteCertificate,
      row.studyCertificate,
      row.transferCertificate,
      ...(row.disability ? [row.disabilityCertificate] : []),
    ].filter((doc): doc is string => !!doc).length;

  const totalDocuments = (row: UploadDocsResponse) => (row.disability ? 9 : 8);

  const getFullName = (row: UploadDocsResponse) =>
    row.student?.user?.name?.trim() || row.nameAsPer10th?.trim() || "-";

  const generateReportPdf = () => {
    const rows = filteredDocuments;
    if (rows.length === 0) {
      toast.error("No applications to include in the report.");
      return;
    }

    const uploaded = rows.map(countUploadedDocuments);
    const totals = rows.map(totalDocuments);

    setReportData({
      generatedAt: new Date().toLocaleString(),
      total: rows.length,
      complete: rows.filter((_, i) => uploaded[i] === totals[i]).length,
      incomplete: rows.filter((_, i) => (uploaded[i] ?? 0) < (totals[i] ?? 0))
        .length,
      rows: rows.map((row, i) => ({
        applicationId: row.applicationId || "-",
        name: getFullName(row),
        email: row.primaryEmail || "-",
        status: row.status || "-",
        uploaded: uploaded[i] ?? 0,
        total: totals[i] ?? 0,
      })),
    });
  };

  useEffect(() => {
    if (!reportData) return;
    const node = reportRef.current;
    if (!node) return;
    void renderNodeToPdf(
      node,
      `upload-documents-report-${new Date().toISOString().slice(0, 10)}.pdf`
    )
      .then(() => toast.success("Upload documents report PDF downloaded."))
      .catch(() =>
        toast.error("Failed to generate the upload documents report PDF.")
      )
      .finally(() => setReportData(null));
  }, [reportData]);

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
            dialogDescription="Filter admission documents by email, application ID, status, mode, and date range."
            onGenerateReport={generateReportPdf}
            reportButtonLabel="Generate Upload Documents Report PDF"
          />
        </div>

        <div>
          <h3 className="text-xl font-semibold tracking-tight">
            Admission Documents
          </h3>

          <p className="text-muted-foreground text-sm">
            Upload and manage admission documents for applicants.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading documents...
          </div>
        ) : (
          <div className="space-y-3">
            {isFetching && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying filters...
              </div>
            )}

            <DataTable columns={uploadDocsColumns} data={filteredDocuments} />
          </div>
        )}
      </div>

      <div
        className="pointer-events-none absolute left-[-10000px] top-0"
        aria-hidden="true"
      >
        <div ref={reportRef}>
          {reportData ? <UploadDocsReportDocument data={reportData} /> : null}
        </div>
      </div>
    </div>
  );
}
