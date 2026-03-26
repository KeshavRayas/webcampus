"use client";

import { authClient } from "@/lib/auth-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { DepartmentFacultyResponseType } from "@webcampus/schemas/department";
import { DesignationEnum } from "@webcampus/schemas/faculty";
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
import { departmentFacultyColumns } from "./department-faculty-columns";

type FacultyFilters = {
  name: string;
  email: string;
  department: string;
  designation: string;
};

const EMPTY_FILTERS: FacultyFilters = {
  name: "",
  email: "",
  department: "",
  designation: "",
};

const formatDesignation = (designation: string) => {
  return designation
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
};

export const DepartmentFacultyView = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  // Fetch department type for conditional filter rendering
  const { data: deptInfo } = useQuery({
    queryKey: ["department-info"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<{ type: string; name: string }>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/section/department-info`,
        {
          withCredentials: true,
        }
      );
      if (res.data.status === "success") return res.data.data;
      return { type: "DEGREE_GRANTING", name: "" };
    },
    enabled: !!session?.user?.id,
  });

  const isDegreeGranting = deptInfo?.type === "DEGREE_GRANTING";
  const [draftFilters, setDraftFilters] = useState<FacultyFilters>(() =>
    getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );
  const [appliedFilters, setAppliedFilters] = useState<FacultyFilters>(() =>
    getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );

  useEffect(() => {
    const nextFilters = getFiltersFromSearchParams(searchParams, EMPTY_FILTERS);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams]);

  const updateDraftFilter = (key: keyof FacultyFilters, value: string) => {
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
    queryKey: ["faculty", appliedFilters],
    queryFn: async () => {
      const apiFilters = {
        ...(appliedFilters.name ? { name: appliedFilters.name } : {}),
        ...(appliedFilters.email ? { email: appliedFilters.email } : {}),
        ...(appliedFilters.department
          ? { department: appliedFilters.department }
          : {}),
        ...(appliedFilters.designation
          ? { designation: appliedFilters.designation }
          : {}),
      };

      const res = await axios.get<
        BaseResponse<DepartmentFacultyResponseType[]>
      >(`${frontendEnv().NEXT_PUBLIC_API_BASE_URL}/department/faculty`, {
        params: apiFilters,
        withCredentials: true,
      });

      if (res.data.status === "success" && Array.isArray(res.data.data)) {
        return res.data.data;
      }

      return [] as DepartmentFacultyResponseType[];
    },
  });

  const departmentOptions = useMemo(() => {
    const options = Array.from(
      new Set((response.data || []).map((faculty) => faculty.department))
    );

    if (draftFilters.department && !options.includes(draftFilters.department)) {
      return [draftFilters.department, ...options];
    }

    return options;
  }, [response.data, draftFilters.department]);

  const allFilterFields: FilterFieldConfig<FacultyFilters>[] = [
    {
      key: "name",
      label: "Faculty Name",
      type: "text",
      inputId: "department-faculty-name",
      placeholder: "Search by faculty name",
      className: "xl:col-span-2",
    },
    {
      key: "email",
      label: "Email",
      type: "text",
      inputId: "department-faculty-email",
      placeholder: "Search by email",
    },
    {
      key: "department",
      label: "Department",
      type: "select",
      allOptionLabel: "All departments",
      placeholder: "All departments",
      options: departmentOptions.map((department) => ({
        label: department,
        value: department,
      })),
    },
    {
      key: "designation",
      label: "Designation",
      type: "select",
      allOptionLabel: "All designations",
      placeholder: "All designations",
      options: DesignationEnum.options.map((designation) => ({
        label: formatDesignation(designation),
        value: designation,
      })),
    },
  ];

  // DEGREE_GRANTING sees only their own faculty — hide redundant dept filter
  const facultyFilterFields = isDegreeGranting
    ? allFilterFields.filter((f) => f.key !== "department")
    : allFilterFields;

  // Guard: show skeleton until session is loaded to prevent hydration mismatch
  if (!session) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Skeleton className="h-10 w-full xl:col-span-2" />
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

  const isDepartmentAdmin = session.user?.role === "department";

  if (!isDepartmentAdmin) {
    return (
      <div className="text-muted-foreground rounded-lg border p-4 text-sm">
        Faculty is available in read-only mode for department admins.
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
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const faculty = response.data || [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">Faculty</h3>
        <p className="text-muted-foreground text-sm">
          Department faculty is read-only. Use filters to refine results.
        </p>
      </div>

      <FilterPanel>
        <FilterBuilder
          fields={facultyFilterFields}
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

      {faculty.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No faculty found for the selected filters.
        </div>
      ) : (
        <DataTable columns={departmentFacultyColumns} data={faculty} />
      )}
    </div>
  );
};
