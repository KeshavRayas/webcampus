"use client";

import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useDepartments } from "@/lib/use-departments";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { AdminStudentResponseType } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  DEFAULT_FILTER_ALL_VALUE,
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { Skeleton } from "@webcampus/ui/components/skeleton";
import axios, { AxiosError } from "axios";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useAcademicTerms } from "../semester/use-academic-term";
import { getAdminStudentColumns } from "./admin-students-columns";

type StudentFilters = {
  usn: string;
  name: string;
  email: string;
  departmentId: string;
  academicTerm: string;
  programType: string;
  semester: string;
};

const EMPTY_FILTERS: StudentFilters = {
  usn: "",
  name: "",
  email: "",
  departmentId: "",
  academicTerm: "",
  programType: "",
  semester: "",
};

export const AdminStudentsView = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];
  const { data: departments = [] } = useDepartments();

  const [draftFilters, setDraftFilters] = useState<StudentFilters>(() =>
    getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );
  const [appliedFilters, setAppliedFilters] = useState<StudentFilters>(() =>
    getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );

  const selectedTerm = useMemo(
    () => terms.find((term) => term.id === draftFilters.academicTerm),
    [terms, draftFilters.academicTerm]
  );

  const selectedTermSemesters = selectedTerm?.Semester || [];
  const filteredTermSemesters =
    draftFilters.programType.length > 0
      ? selectedTermSemesters.filter(
          (semester) => semester.programType === draftFilters.programType
        )
      : selectedTermSemesters;

  // Sync filters when data changes (auto-clear if value no longer exists)
  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: filteredTermSemesters,
    departments,
  });

  useEffect(() => {
    const nextFilters = getFiltersFromSearchParams(searchParams, EMPTY_FILTERS);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams]);

  const updateDraftFilter = (key: keyof StudentFilters, value: string) => {
    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    const query = createFilterQueryString(draftFilters);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    router.replace(pathname, { scroll: false });
  };

  const response = useQuery({
    queryKey: ["admin-students", appliedFilters],
    queryFn: async () => {
      const apiFilters = {
        ...(appliedFilters.usn ? { usn: appliedFilters.usn } : {}),
        ...(appliedFilters.name ? { name: appliedFilters.name } : {}),
        ...(appliedFilters.email ? { email: appliedFilters.email } : {}),
        ...(appliedFilters.departmentId
          ? { departmentId: appliedFilters.departmentId }
          : {}),
        ...(appliedFilters.academicTerm
          ? { academicTermId: appliedFilters.academicTerm }
          : {}),
        ...(appliedFilters.programType
          ? { programType: appliedFilters.programType }
          : {}),
        ...(appliedFilters.semester
          ? { semesterId: appliedFilters.semester }
          : {}),
      };

      const res = await axios.get<BaseResponse<AdminStudentResponseType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/student`,
        {
          params: apiFilters,
          withCredentials: true,
        }
      );

      if (res.data.status === "success" && Array.isArray(res.data.data)) {
        return res.data.data;
      }

      throw new Error(res.data.message || "Failed to fetch students");
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!response.isError) {
      return;
    }

    const message =
      response.error instanceof AxiosError
        ? response.error.response?.data?.error || "Failed to load students"
        : response.error instanceof Error
          ? response.error.message
          : "Failed to load students";

    toast.error(message);
  }, [response.error, response.isError]);

  // Build department options from the fetched departments
  const departmentOptions = useMemo(
    () =>
      departments.map((dept) => ({
        label: dept.name,
        value: dept.id,
      })),
    [departments]
  );

  const termOptions = useMemo(
    () =>
      terms.map((term) => ({
        label: `${term.type.toUpperCase()} ${term.year}`,
        value: term.id,
      })),
    [terms]
  );

  const semesterOptions = useMemo(
    () =>
      filteredTermSemesters.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: semester.id,
      })),
    [filteredTermSemesters]
  );

  const updateAcademicTermFilter = (value: string) => {
    setDraftFilters((current) => ({
      ...current,
      academicTerm: value,
      programType: "",
      semester: "",
    }));
  };

  const updateProgramTypeFilter = (value: string) => {
    setDraftFilters((current) => ({
      ...current,
      programType: value,
      semester: "",
    }));
  };

  const studentFilterFields: FilterFieldConfig<StudentFilters>[] = [
    {
      key: "usn",
      label: "USN",
      type: "text",
      inputId: "admin-student-usn",
      placeholder: "Search by USN",
    },
    {
      key: "name",
      label: "Name",
      type: "text",
      inputId: "admin-student-name",
      placeholder: "Search by name",
    },
    {
      key: "email",
      label: "Email",
      type: "text",
      inputId: "admin-student-email",
      placeholder: "Search by email",
    },
    {
      key: "departmentId",
      label: "Department",
      type: "select",
      allOptionLabel: "All departments",
      placeholder: "All departments",
      options: departmentOptions,
    },
    {
      key: "academicTerm",
      label: "Academic Term",
      type: "select",
      allOptionLabel: "All terms",
      placeholder: "All terms",
      options: termOptions,
    },
    {
      key: "programType",
      label: "Program Type",
      type: "select",
      allOptionLabel: "All programs",
      placeholder: draftFilters.academicTerm
        ? "All programs"
        : "Select term first",
      options: [
        { label: "UG", value: "UG" },
        { label: "PG", value: "PG" },
      ],
    },
    {
      key: "semester",
      label: "Semester",
      type: "select",
      allOptionLabel: "All semesters",
      placeholder: draftFilters.academicTerm
        ? draftFilters.programType
          ? "All semesters"
          : "Select program type"
        : "Select term first",
      options: semesterOptions,
    },
  ];

  if (response.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const students = response.data || [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">Students</h3>
        <p className="text-muted-foreground text-sm">
          Manage all students across all departments.
        </p>
      </div>

      <FilterPanel>
        <FilterBuilder
          fields={studentFilterFields}
          draftFilters={draftFilters}
          onDraftChange={(key, value) => {
            if (key === "academicTerm") {
              updateAcademicTermFilter(value);
              return;
            }

            if (key === "programType") {
              updateProgramTypeFilter(value);
              return;
            }

            updateDraftFilter(key, value);
          }}
          allValue={DEFAULT_FILTER_ALL_VALUE}
          className="md:grid-cols-2 xl:grid-cols-7"
        />
        <FilterActions onApply={applyFilters} onReset={resetFilters} />
      </FilterPanel>

      {response.isFetching && (
        <p className="text-muted-foreground text-sm">Applying filters...</p>
      )}

      {response.isError ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          We could not load students right now. Please retry after a moment.
        </div>
      ) : null}

      {!response.isError && students.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No students found for the selected filters.
        </div>
      ) : !response.isError ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            Showing {students.length} students
          </p>
          <DataTable columns={getAdminStudentColumns(true)} data={students} />
        </div>
      ) : null}
    </div>
  );
};
