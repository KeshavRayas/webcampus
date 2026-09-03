"use client";

import { apiClient } from "@/lib/api-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useHODDepartment } from "@/modules/hod/department/use-hod-department";
import { useQuery } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { Page, PageContent, PageHeader } from "@webcampus/ui/components/page";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

type HodCoursesFiltersState = {
  termId: string;
  semesterId: string;
  cycle: string;
  sectionId: string;
};

const EMPTY_FILTERS: HodCoursesFiltersState = {
  termId: "",
  semesterId: "",
  cycle: "",
  sectionId: "",
};

type HodCourseItem = {
  id: string;
  code: string;
  name: string;
  semester?: number;
  cycle: string;
  courseType: string;
  credits: number;
};

export const HodCoursesView = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: hodDepartment } = useHODDepartment();

  const [draftFilters, setDraftFilters] = useState<HodCoursesFiltersState>(() =>
    getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );
  const [appliedFilters, setAppliedFilters] = useState<HodCoursesFiltersState>(
    () => getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );

  useEffect(() => {
    const nextFilters = getFiltersFromSearchParams(searchParams, EMPTY_FILTERS);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams]);

  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];

  const selectedDraftTerm = terms.find(
    (term) => term.id === draftFilters.termId
  );
  const allSemestersForSelectedDraftTerm = selectedDraftTerm?.Semester ?? [];

  const isFirstYearDepartment =
    hodDepartment?.departmentType === "BASIC_SCIENCES";

  // Use the standard hook for term -> semester cascading
  useCascadingFilterSync(
    draftFilters,
    setDraftFilters as unknown as React.Dispatch<
      React.SetStateAction<Record<string, string>>
    >,
    {
      academicTerms: terms,
      semesters: allSemestersForSelectedDraftTerm,
    }
  );

  const semesterOptions = useMemo(() => {
    if (isFirstYearDepartment) {
      return allSemestersForSelectedDraftTerm.filter((s) =>
        FIRST_YEAR_UG_SEMESTERS.has(s.semesterNumber)
      );
    }
    const termType = selectedDraftTerm?.type;
    if (termType === "odd") {
      return allSemestersForSelectedDraftTerm.filter(
        (s) => s.semesterNumber >= 3 && s.semesterNumber % 2 === 1
      );
    }
    if (termType === "even") {
      return allSemestersForSelectedDraftTerm.filter(
        (s) => s.semesterNumber >= 4 && s.semesterNumber % 2 === 0
      );
    }
    return allSemestersForSelectedDraftTerm.filter(
      (s) => !FIRST_YEAR_UG_SEMESTERS.has(s.semesterNumber)
    );
  }, [
    allSemestersForSelectedDraftTerm,
    isFirstYearDepartment,
    selectedDraftTerm?.type,
  ]);

  const selectedDraftSemester = semesterOptions.find(
    (s) => s.id === draftFilters.semesterId
  );

  const isSemesterOneOrTwo =
    !!selectedDraftSemester &&
    FIRST_YEAR_UG_SEMESTERS.has(selectedDraftSemester.semesterNumber);

  // Fetch Sections for the given semester & cycle
  const { data: rawSections, isLoading: loadingSections } = useQuery({
    queryKey: ["hod-sections", draftFilters.semesterId, draftFilters.cycle],
    queryFn: async () => {
      if (!draftFilters.semesterId) return [];
      const res = await apiClient.get<
        BaseResponse<{ id: string; name: string }[]>
      >(`/hod/courses/sections`, {
        params: {
          semesterId: draftFilters.semesterId,
          ...(isSemesterOneOrTwo && draftFilters.cycle
            ? { cycle: draftFilters.cycle }
            : {}),
        },
      });
      if (res.data.status === "success") return res.data.data ?? [];
      return [];
    },
    enabled: !!draftFilters.semesterId,
  });
  const sections = Array.isArray(rawSections) ? rawSections : [];

  const isApplyReady = true;

  const applyFilters = () => {
    const nextFilters = {
      ...draftFilters,
      cycle: isSemesterOneOrTwo
        ? draftFilters.cycle || BASIC_SCIENCES_CYCLE_OPTIONS[0]
        : "",
    };
    setAppliedFilters(nextFilters);
    const query = createFilterQueryString(nextFilters);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    router.replace(pathname, { scroll: false });
  };

  const { data: response, isLoading: loadingCourses } = useQuery({
    queryKey: ["hod-courses-list", appliedFilters],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<HodCourseItem[]>>(
        `/hod/courses`,
        {
          params: {
            academicTermId: appliedFilters.termId,
            semesterId: appliedFilters.semesterId,
            sectionId: appliedFilters.sectionId,
            ...(isSemesterOneOrTwo && appliedFilters.cycle
              ? { cycle: appliedFilters.cycle }
              : {}),
          },
        }
      );
      return res.data;
    },
  });

  const courseData =
    response?.status === "success" ? (response.data as HodCourseItem[]) : [];

  const columns = [
    {
      accessorKey: "code",
      header: "Course Code",
    },
    {
      accessorKey: "name",
      header: "Course Name",
    },
    {
      accessorKey: "courseType",
      header: "Type",
    },
    {
      accessorKey: "credits",
      header: "Credits",
    },
    {
      accessorKey: "semester",
      header: "Semester",
      cell: ({ row }: { row: { original: { semester?: number | null } } }) => {
        return row.original.semester || "-";
      },
    },
    {
      accessorKey: "cycle",
      header: "Cycle",
      cell: ({ row }: { row: { original: { cycle: string } } }) => {
        return row.original.cycle === "NONE" ? "-" : row.original.cycle;
      },
    },
  ];

  const filterFields: FilterFieldConfig<HodCoursesFiltersState>[] = [
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      options: terms.map((term) => ({
        label: `${term.type.toUpperCase()} ${term.year}`,
        value: term.id,
      })),
      hideAllOption: false,
      placeholder: "All terms",
    },
    {
      key: "semesterId",
      label: "Semester",
      type: "select",
      options: semesterOptions.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: semester.id,
      })),
      placeholder: draftFilters.termId ? "All semesters" : "Select term first",
      hideAllOption: false,
    },
    ...(isSemesterOneOrTwo && isFirstYearDepartment
      ? [
          {
            key: "cycle",
            label: "Cycle",
            type: "select",
            options: BASIC_SCIENCES_CYCLE_OPTIONS.map((cycle) => ({
              label: cycle,
              value: cycle,
            })),
            hideAllOption: false,
            placeholder: "All cycles",
          } as FilterFieldConfig<HodCoursesFiltersState>,
        ]
      : []),
    {
      key: "sectionId",
      label: "Section",
      type: "select",
      placeholder: loadingSections ? "Loading sections..." : "All sections",
      options: sections.map((sec) => ({
        label: sec.name,
        value: sec.id,
      })),
      hideAllOption: false,
    },
  ];

  return (
    <Page>
      <PageHeader title="Department Courses">
        <p className="text-muted-foreground text-sm">
          View and filter courses managed by your department.
        </p>
      </PageHeader>
      <PageContent>
        <div className="space-y-6">
          <FilterPanel>
            <FilterBuilder
              fields={filterFields}
              draftFilters={draftFilters}
              onDraftChange={(key, value) => {
                setDraftFilters((current) => {
                  const next = { ...current, [key]: value };
                  if (key === "termId") {
                    next.semesterId = "";
                    next.cycle = "";
                    next.sectionId = "";
                  } else if (key === "semesterId") {
                    next.cycle = "";
                    next.sectionId = "";
                  } else if (key === "cycle") {
                    next.sectionId = "";
                  }
                  return next;
                });
              }}
            />
            <div className="mt-4 flex justify-end">
              <FilterActions
                onApply={applyFilters}
                onReset={resetFilters}
                isApplyDisabled={!isApplyReady}
                applyLabel="Apply Filters"
              />
            </div>
          </FilterPanel>

          <div className="bg-card text-card-foreground rounded-xl border shadow-sm">
            {loadingCourses ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center p-8">
                <Loader2 className="mb-2 h-8 w-8 animate-spin" />
                <p>Loading courses...</p>
              </div>
            ) : (
              <div className="p-4">
                <DataTable columns={columns} data={courseData} />
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
};
