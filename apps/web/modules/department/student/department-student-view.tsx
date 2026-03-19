"use client";

import { authClient } from "@/lib/auth-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { DepartmentStudentResponseType } from "@webcampus/schemas/department";
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
import React, { useEffect, useState } from "react";
import { departmentStudentColumns } from "./department-student-columns";

type StudentFilters = {
  usn: string;
  name: string;
  departmentName: string;
  currentSemester: string;
  academicYear: string;
};

const EMPTY_FILTERS: StudentFilters = {
  usn: "",
  name: "",
  departmentName: "",
  currentSemester: "",
  academicYear: "",
};

const studentFilterFields: FilterFieldConfig<StudentFilters>[] = [
  {
    key: "usn",
    label: "USN",
    type: "text",
    inputId: "department-student-usn",
    placeholder: "Search by USN",
    className: "xl:col-span-2",
  },
  {
    key: "name",
    label: "Student Name",
    type: "text",
    inputId: "department-student-name",
    placeholder: "Search by student name",
  },
  {
    key: "departmentName",
    label: "Department",
    type: "text",
    inputId: "department-student-department-name",
    placeholder: "Search by department",
  },
  {
    key: "currentSemester",
    label: "Current Semester",
    type: "select",
    allOptionLabel: "All semesters",
    placeholder: "All semesters",
    options: [
      { label: "1", value: "1" },
      { label: "2", value: "2" },
      { label: "3", value: "3" },
      { label: "4", value: "4" },
      { label: "5", value: "5" },
      { label: "6", value: "6" },
      { label: "7", value: "7" },
      { label: "8", value: "8" },
    ],
  },
  {
    key: "academicYear",
    label: "Academic Year",
    type: "text",
    inputId: "department-student-academic-year",
    placeholder: "Search by academic year",
  },
];

export const DepartmentStudentView = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();

  const [draftFilters, setDraftFilters] = useState<StudentFilters>(() =>
    getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );
  const [appliedFilters, setAppliedFilters] = useState<StudentFilters>(() =>
    getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );

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
    queryKey: ["department-students", appliedFilters],
    queryFn: async () => {
      const apiFilters = {
        ...(appliedFilters.usn ? { usn: appliedFilters.usn } : {}),
        ...(appliedFilters.name ? { name: appliedFilters.name } : {}),
        ...(appliedFilters.departmentName
          ? { departmentName: appliedFilters.departmentName }
          : {}),
        ...(appliedFilters.currentSemester
          ? { currentSemester: Number.parseInt(appliedFilters.currentSemester, 10) }
          : {}),
        ...(appliedFilters.academicYear
          ? { academicYear: appliedFilters.academicYear }
          : {}),
      };

      const res = await axios.get<
        BaseResponse<DepartmentStudentResponseType[]>
      >(`${frontendEnv().NEXT_PUBLIC_API_BASE_URL}/department/student`, {
        params: apiFilters,
        withCredentials: true,
      });

      if (res.data.status === "success" && Array.isArray(res.data.data)) {
        return res.data.data;
      }

      return [] as DepartmentStudentResponseType[];
    },
  });

  const isDepartmentAdmin = session?.user?.role === "department";

  if (!isDepartmentAdmin) {
    return (
      <div className="text-muted-foreground rounded-lg border p-4 text-sm">
        Students are available in read-only mode for department admins.
      </div>
    );
  }

  if (response.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Skeleton className="h-10 w-full xl:col-span-2" />
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
          Students are read-only. Use filters to refine results.
        </p>
      </div>

      <FilterPanel>
        <FilterBuilder
          fields={studentFilterFields}
          draftFilters={draftFilters}
          onDraftChange={updateDraftFilter}
          allValue={DEFAULT_FILTER_ALL_VALUE}
          className="md:grid-cols-2 xl:grid-cols-5"
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
        <DataTable columns={departmentStudentColumns} data={students} />
      )}
    </div>
  );
};
