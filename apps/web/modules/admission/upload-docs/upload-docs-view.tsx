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
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { getAdmissionFullName } from "../admin/admin-admission-columns";
import { renderNodeToPdf } from "../applicant/admission-pdf";
import { AdmissionFilterBar } from "../shared/admission-filter-bar";
import { uploadDocsColumns, UploadDocsResponse } from "./upload-docs-columns";

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
  name: string;
  filledBy: string;
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
  name: "",
  filledBy: "",
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
    let rows = data ?? [];
    const email = appliedFilters.email.trim().toLowerCase();
    if (email) {
      rows = rows.filter((admission) =>
        admission.primaryEmail?.toLowerCase().includes(email)
      );
    }
    const name = appliedFilters.name.trim().toLowerCase();
    if (name) {
      rows = rows.filter((admission) =>
        getAdmissionFullName(admission).toLowerCase().includes(name)
      );
    }
    if (appliedFilters.filledBy) {
      rows = rows.filter(
        (admission) => admission.filledBy?.id === appliedFilters.filledBy
      );
    }
    return rows;
  }, [
    data,
    appliedFilters.email,
    appliedFilters.name,
    appliedFilters.filledBy,
  ]);

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

  const advancedFilterFields: FilterFieldConfig<UploadDocumentFilters>[] = [
    {
      key: "name",
      label: "Name",
      type: "text",
      inputId: "name",
      placeholder: "Search by name",
    },
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
        name: getAdmissionFullName(row),
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
    </div>
  );
}
