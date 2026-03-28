"use client";

import { authClient } from "@/lib/auth-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useDepartments } from "@/lib/use-departments";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
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
import React, { useEffect, useMemo, useState } from "react";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { departmentStudentColumns } from "./department-student-columns";

type StudentFilters = {
  usn: string;
  name: string;
  departmentName: string;
  academicTerm: string;
  semester: string;
  section: string;
};

const EMPTY_FILTERS: StudentFilters = {
  usn: "",
  name: "",
  departmentName: "",
  academicTerm: "",
  semester: "",
  section: "",
};

export const DepartmentStudentView = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  // Track if we've checked authorization after hydration
  const [isHydrated, setIsHydrated] = useState(false);

  // Initialize state early so it can be used in useMemo hooks below
  const [draftFilters, setDraftFilters] = useState<StudentFilters>(() =>
    getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );
  const [appliedFilters, setAppliedFilters] = useState<StudentFilters>(() =>
    getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );

  // Mark when component has hydrated to avoid SSR/client mismatch
  useEffect(() => {
    setIsHydrated(true);
  }, []);

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

  const { data: terms = [] } = useAcademicTerms();
  const { data: departments = [] } = useDepartments();

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

  const semesterOptions = useMemo(
    () =>
      (selectedTermSemesters).map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: `${semester.programType} - Semester ${semester.semesterNumber}`,
      })),
    [selectedTermSemesters]
  );

  const appliedTermYear = useMemo(() => {
    if (!appliedFilters.academicTerm) {
      return "";
    }

    return (
      terms.find((term) => term.id === appliedFilters.academicTerm)?.year || ""
    );
  }, [terms, appliedFilters.academicTerm]);

  const response = useQuery({
    queryKey: ["department-students", appliedFilters, appliedTermYear],
    queryFn: async () => {
      const apiFilters = {
        ...(appliedFilters.usn ? { usn: appliedFilters.usn } : {}),
        ...(appliedFilters.name ? { name: appliedFilters.name } : {}),
        ...(appliedFilters.departmentName
          ? { departmentName: appliedFilters.departmentName }
          : {}),
        ...(appliedFilters.semester
          ? { currentSemester: appliedFilters.semester }
          : {}),
        ...(appliedTermYear ? { academicYear: appliedTermYear } : {}),
        ...(appliedFilters.section ? { section: appliedFilters.section } : {}),
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

  const sectionOptions = useMemo(() => {
    const options = Array.from(
      new Set((response.data || []).map((student) => student.section).filter(Boolean))
    ) as string[];

    if (draftFilters.section && !options.includes(draftFilters.section)) {
      return [draftFilters.section, ...options];
    }

    return options;
  }, [draftFilters.section, response.data]);

  // Build filter fields dynamically based on department type
  const studentFilterFields = useMemo(() => {
    const allFields: FilterFieldConfig<StudentFilters>[] = [
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
        key: "academicTerm",
        label: "Academic Term",
        type: "select",
        allOptionLabel: "All terms",
        placeholder: "All terms",
        options: terms.map((term) => ({
          label: `${term.type.toUpperCase()} ${term.year}`,
          value: term.id,
        })),
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
      {
        key: "section",
        label: "Section",
        type: "select",
        allOptionLabel: "All sections",
        placeholder: "All sections",
        options: sectionOptions.map((section) => ({
          label: section,
          value: section,
        })),
      },
    ];

    // DEGREE_GRANTING sees only their own students — hide redundant dept filter
    return isDegreeGranting
      ? allFields.filter((f) => f.key !== "departmentName")
      : allFields;
  }, [
    draftFilters.academicTerm,
    isDegreeGranting,
    sectionOptions,
    semesterOptions,
    terms,
  ]);

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

  const updateAcademicTermFilter = (value: string) => {
    setDraftFilters((current) => ({
      ...current,
      academicTerm: value,
      semester: "",
      section: "",
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

  const isDepartmentAdmin = session?.user?.role === "department";

  // Only enforce authorization check after hydration to avoid SSR/client mismatch
  if (isHydrated && !isDepartmentAdmin) {
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
        <DataTable columns={departmentStudentColumns} data={students} />
      )}
    </div>
  );
};
