"use client";

import { apiClient } from "@/lib/api-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAdmissionDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import { admissionModes, admissionTypes } from "@webcampus/schemas/constants";
import { BaseResponse } from "@webcampus/types/api";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  FilterActions,
  FilterBuilder,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { uploadDocsColumns, UploadDocsResponse } from "./upload-docs-columns";

const ADMISSION_STATUSES = [
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;

const ALL_FILTERS_VALUE = "__all__";

type UploadDocumentFilters = {
  applicationId: string;
  status: string;
  mode: string;
  admissionType: string;
  academicTerm: string;
  semester: string;
  createdFrom: string;
  createdTo: string;
};

const EMPTY_FILTERS: UploadDocumentFilters = {
  applicationId: "",
  status: "",
  mode: "",
  admissionType: "",
  academicTerm: "",
  semester: "",
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
      const query = createFilterQueryString(appliedFilters);

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

  const filterFields: FilterFieldConfig<UploadDocumentFilters>[] = [
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
    {
      key: "applicationId",
      label: "Application ID",
      type: "text",
      inputId: "applicationId",
      placeholder: "Search application ID",
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

  return (
    <div className="space-y-8">
      <div className="bg-card text-card-foreground space-y-6 rounded-lg border p-6 shadow-sm">
        <div className="space-y-4">
          <FilterBuilder
            fields={filterFields}
            draftFilters={draftFilters}
            onDraftChange={updateDraftFilter}
            allValue={ALL_FILTERS_VALUE}
            className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-6"
          />

          <FilterActions onApply={applyFilters} onReset={resetFilters} />
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

            <DataTable columns={uploadDocsColumns} data={data ?? []} />
          </div>
        )}
      </div>
    </div>
  );
}
