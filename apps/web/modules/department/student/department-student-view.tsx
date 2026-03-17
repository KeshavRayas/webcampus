"use client";

import { authClient } from "@/lib/auth-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  AdmissionStatusEnum,
  DepartmentStudentResponseType,
} from "@webcampus/schemas/department";
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
  tempUsn: string;
  name: string;
  status: string;
  modeOfAdmission: string;
  gender: string;
};

const EMPTY_FILTERS: StudentFilters = {
  tempUsn: "",
  name: "",
  status: "",
  modeOfAdmission: "",
  gender: "",
};

const formatStatus = (status: string) => {
  return status.charAt(0) + status.slice(1).toLowerCase();
};

const studentFilterFields: FilterFieldConfig<StudentFilters>[] = [
  {
    key: "tempUsn",
    label: "USN",
    type: "text",
    inputId: "department-student-tempusn",
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
    key: "status",
    label: "Status",
    type: "select",
    allOptionLabel: "All statuses",
    placeholder: "All statuses",
    options: AdmissionStatusEnum.options.map((s) => ({
      label: formatStatus(s),
      value: s,
    })),
  },
  {
    key: "modeOfAdmission",
    label: "Mode of Admission",
    type: "select",
    allOptionLabel: "All modes",
    placeholder: "All modes",
    options: [
      { label: "KCET", value: "KCET" },
      { label: "COMEDK", value: "COMEDK" },
      { label: "Management", value: "Management" },
      { label: "SNQ Quota", value: "SNQ Quota" },
      { label: "Other", value: "Other" },
    ],
  },
  {
    key: "gender",
    label: "Gender",
    type: "select",
    allOptionLabel: "All genders",
    placeholder: "All genders",
    options: [
      { label: "Male", value: "Male" },
      { label: "Female", value: "Female" },
    ],
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
        ...(appliedFilters.tempUsn ? { tempUsn: appliedFilters.tempUsn } : {}),
        ...(appliedFilters.name ? { name: appliedFilters.name } : {}),
        ...(appliedFilters.status ? { status: appliedFilters.status } : {}),
        ...(appliedFilters.modeOfAdmission
          ? { modeOfAdmission: appliedFilters.modeOfAdmission }
          : {}),
        ...(appliedFilters.gender ? { gender: appliedFilters.gender } : {}),
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
