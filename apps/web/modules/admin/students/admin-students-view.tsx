"use client";

import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useDepartments } from "@/lib/use-departments";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  AdminStudentResponseType,
} from "@webcampus/schemas/admin";
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
import axios from "axios";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { useAcademicTerms } from "../semester/use-academic-term";
import { adminStudentColumns } from "./admin-students-columns";

type StudentFilters = {
  usn: string;
  name: string;
  email: string;
  departmentName: string;
  academicTerm: string;
  semester: string;
};

const EMPTY_FILTERS: StudentFilters = {
  usn: "",
  name: "",
  email: "",
  departmentName: "",
  academicTerm: "",
  semester: "",
};

export const AdminStudentsView = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const { data: terms = [] } = useAcademicTerms();
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

  // Sync filters when data changes (auto-clear if value no longer exists)
  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: selectedTermSemesters,
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

  const appliedTermYear = useMemo(() => {
    if (!appliedFilters.academicTerm) {
      return "";
    }

    return (
      terms.find((term) => term.id === appliedFilters.academicTerm)?.year || ""
    );
  }, [terms, appliedFilters.academicTerm]);

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
    queryKey: ["admin-students", appliedFilters, appliedTermYear],
    queryFn: async () => {
      const apiFilters = {
        ...(appliedFilters.usn ? { usn: appliedFilters.usn } : {}),
        ...(appliedFilters.name ? { name: appliedFilters.name } : {}),
        ...(appliedFilters.email ? { email: appliedFilters.email } : {}),
        ...(appliedFilters.departmentName
          ? { departmentId: appliedFilters.departmentName }
          : {}),
        ...(appliedFilters.semester
          ? { currentSemester: appliedFilters.semester }
          : {}),
        ...(appliedTermYear ? { academicYear: appliedTermYear } : {}),
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

      return [] as AdminStudentResponseType[];
    },
  });

  // Build department options from the fetched departments
  const departmentOptions = useMemo(
    () => departments.map((dept) => ({
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
      selectedTermSemesters.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: `${semester.programType} - Semester ${semester.semesterNumber}`,
      })),
    [selectedTermSemesters]
  );

  const updateAcademicTermFilter = (value: string) => {
    setDraftFilters((current) => ({
      ...current,
      academicTerm: value,
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
      key: "departmentName",
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
      key: "semester",
      label: "Semester",
      type: "select",
      allOptionLabel: "All semesters",
      placeholder: draftFilters.academicTerm
        ? "All semesters"
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

            updateDraftFilter(key, value);
          }}
          allValue={DEFAULT_FILTER_ALL_VALUE}
          className="md:grid-cols-2 xl:grid-cols-6"
        />
        <FilterActions onApply={applyFilters} onReset={resetFilters} />
      </FilterPanel>

      {response.isFetching && (
        <p className="text-muted-foreground text-sm">Applying filters...</p>
      )}

      {students.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No students found for the selected filters.
        </div>
      ) : (
        <DataTable columns={adminStudentColumns} data={students} />
      )}
    </div>
  );
};
