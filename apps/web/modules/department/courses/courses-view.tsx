"use client";

import { authClient } from "@/lib/auth-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { CourseResponseDTO } from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import {
  DEFAULT_FILTER_ALL_VALUE,
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import axios from "axios";
import { Lock } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { SemesterCourseBlock } from "./semester-course-block";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;
type CourseCycle = "PHYSICS" | "CHEMISTRY" | "NONE";

type CoursesFilters = {
  termId: string;
  semesterId: string;
  cycle: string;
};

const EMPTY_FILTERS: CoursesFilters = {
  termId: "",
  semesterId: "",
  cycle: "",
};

export const CoursesView: React.FC = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const departmentName = session?.user?.name;

  // Fetch department type for conditional rendering
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

  const departmentType = deptInfo?.type ?? "DEGREE_GRANTING";
  const isBasicSciences = departmentType === "BASIC_SCIENCES";

  const [draftFilters, setDraftFilters] = useState<CoursesFilters>(() =>
    getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );
  const [appliedFilters, setAppliedFilters] = useState<CoursesFilters>(() =>
    getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );

  useEffect(() => {
    const nextFilters = getFiltersFromSearchParams(searchParams, EMPTY_FILTERS);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams]);

  useEffect(() => {
    if (isBasicSciences && !draftFilters.cycle) {
      setDraftFilters((current) => ({
        ...current,
        cycle: BASIC_SCIENCES_CYCLE_OPTIONS[0],
      }));
      return;
    }

    if (!isBasicSciences && draftFilters.cycle) {
      setDraftFilters((current) => ({
        ...current,
        cycle: "",
      }));
    }
  }, [draftFilters.cycle, isBasicSciences]);

  // Fetch all available academic terms (with nested semesters)
  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];

  const selectedDraftTerm = terms.find((t) => t.id === draftFilters.termId);
  const allSemestersForSelectedDraftTerm = selectedDraftTerm?.Semester ?? [];

  // Sync filters when data changes (auto-clear if value no longer exists)
  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: allSemestersForSelectedDraftTerm,
  });

  const semesterOptions = useMemo(() => {
    const isFirstYearUgSemester = (semester: {
      programType: string;
      semesterNumber: number;
    }) =>
      semester.programType === "UG" &&
      FIRST_YEAR_UG_SEMESTERS.has(semester.semesterNumber);

    if (!isBasicSciences) {
      return allSemestersForSelectedDraftTerm.filter(
        (semester) => !isFirstYearUgSemester(semester)
      );
    }

    return allSemestersForSelectedDraftTerm.filter((semester) =>
      isFirstYearUgSemester(semester)
    );
  }, [allSemestersForSelectedDraftTerm, isBasicSciences]);

  const selectedAppliedTerm = terms.find(
    (term) => term.id === appliedFilters.termId
  );
  const selectedAppliedSemester = (selectedAppliedTerm?.Semester || []).find(
    (semester) => semester.id === appliedFilters.semesterId
  );

  const updateDraftFilter = (key: keyof CoursesFilters, value: string) => {
    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyFilters = () => {
    const nextFilters = {
      ...draftFilters,
      cycle: isBasicSciences
        ? draftFilters.cycle || BASIC_SCIENCES_CYCLE_OPTIONS[0]
        : "",
    };

    setAppliedFilters(nextFilters);
    const query = createFilterQueryString(nextFilters);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    router.replace(pathname, { scroll: false });
  };

  useEffect(() => {
    if (!draftFilters.semesterId) {
      return;
    }

    const isSelectedSemesterAllowed = semesterOptions.some(
      (semester) => semester.id === draftFilters.semesterId
    );

    if (!isSelectedSemesterAllowed) {
      setDraftFilters((current) => ({
        ...current,
        semesterId: "",
      }));
    }
  }, [draftFilters.semesterId, semesterOptions]);

  useEffect(() => {
    if (draftFilters.termId || terms.length === 0) {
      return;
    }

    const currentTerm = terms.find((term) => term.isCurrent) ?? terms[0];
    if (currentTerm) {
      setDraftFilters((current) => ({
        ...current,
        termId: currentTerm.id,
      }));
    }
  }, [draftFilters.termId, terms]);

  useEffect(() => {
    if (!draftFilters.termId || draftFilters.semesterId) {
      return;
    }

    const requestedSemesterParam =
      searchParams.get("semesterId") ?? searchParams.get("semester");

    if (requestedSemesterParam) {
      const isRequestedSemesterAllowed = semesterOptions.some(
        (semester) => semester.id === requestedSemesterParam
      );

      if (isRequestedSemesterAllowed) {
        setDraftFilters((current) => ({
          ...current,
          semesterId: requestedSemesterParam,
        }));
      } else {
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete("semesterId");
        nextParams.delete("semester");
        const nextUrl = nextParams.toString()
          ? `${pathname}?${nextParams.toString()}`
          : pathname;
        router.replace(nextUrl, { scroll: false });
      }
      return;
    }

    if (semesterOptions.length > 0) {
      setDraftFilters((current) => ({
        ...current,
        semesterId: semesterOptions[0]!.id,
      }));
    }
  }, [
    draftFilters.semesterId,
    draftFilters.termId,
    pathname,
    router,
    searchParams,
    semesterOptions,
  ]);

  useEffect(() => {
    if (appliedFilters.termId && appliedFilters.semesterId) {
      return;
    }

    if (!draftFilters.termId || !draftFilters.semesterId) {
      return;
    }

    const initializedFilters = {
      ...draftFilters,
      cycle: isBasicSciences
        ? draftFilters.cycle || BASIC_SCIENCES_CYCLE_OPTIONS[0]
        : "",
    };

    setAppliedFilters(initializedFilters);
  }, [
    appliedFilters.semesterId,
    appliedFilters.termId,
    draftFilters,
    isBasicSciences,
  ]);

  const courseFilterFields: FilterFieldConfig<CoursesFilters>[] = [
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      placeholder: "Select term...",
      allOptionLabel: "All terms",
      options: terms.map((term) => ({
        label: `${term.type.charAt(0).toUpperCase() + term.type.slice(1)} ${term.year}`,
        value: term.id,
      })),
    },
    {
      key: "semesterId",
      label: "Semester",
      type: "select",
      placeholder: draftFilters.termId
        ? "Select semester..."
        : "Select term first",
      allOptionLabel: "All semesters",
      options: semesterOptions.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: semester.id,
      })),
    },
    ...(isBasicSciences
      ? [
          {
            key: "cycle",
            label: "Cycle",
            type: "select",
            placeholder: "Select cycle...",
            allOptionLabel: "All cycles",
            options: BASIC_SCIENCES_CYCLE_OPTIONS.map((cycle) => ({
              label: cycle,
              value: cycle,
            })),
          } as FilterFieldConfig<CoursesFilters>,
        ]
      : []),
  ];

  // Fetch courses ONLY for the selected semester instance
  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["courses", departmentName, appliedFilters.semesterId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<CourseResponseDTO[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/branch`,
        {
          params: {
            name: departmentName,
            semesterId: appliedFilters.semesterId,
          },
          withCredentials: true,
        }
      );
      if (res.data.status === "success") return res.data.data;
      return [];
    },
    enabled: !!departmentName && !!appliedFilters.semesterId,
  });

  const appliedCycle =
    isBasicSciences && appliedFilters.cycle
      ? (appliedFilters.cycle as CourseCycle)
      : "NONE";

  const filteredCourses = useMemo(() => {
    const courseList = courses ?? [];
    if (!isBasicSciences || !appliedFilters.cycle) {
      return courseList;
    }

    return courseList.filter(
      (course) => (course.cycle ?? "NONE") === appliedCycle
    );
  }, [appliedCycle, appliedFilters.cycle, courses, isBasicSciences]);

  const isSemesterLocked = useMemo(() => {
    return filteredCourses.some(
      (c) => c.approvalStatus === "PENDING" || c.approvalStatus === "APPROVED"
    );
  }, [filteredCourses]);

  return (
    <div className="space-y-8">
      {isSemesterLocked && (
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-3 rounded-lg border p-4">
          <Lock className="mt-0.5 h-5 w-5" />
          <div className="flex flex-col gap-1">
            <h5 className="font-medium leading-none tracking-tight">
              Semester Locked
            </h5>
            <div className="text-sm">
              This semester is currently locked for review/approval. You cannot
              add, edit, or delete courses.
            </div>
          </div>
        </div>
      )}

      <FilterPanel>
        <FilterBuilder
          fields={courseFilterFields}
          draftFilters={draftFilters}
          onDraftChange={(key, value) => {
            if (key === "termId") {
              setDraftFilters((current) => ({
                ...current,
                termId: value,
                semesterId: "",
              }));
              return;
            }

            updateDraftFilter(key, value);
          }}
          allValue={DEFAULT_FILTER_ALL_VALUE}
          className="md:grid-cols-2 xl:grid-cols-3"
        />
        <FilterActions onApply={applyFilters} onReset={resetFilters} />
      </FilterPanel>

      {/* Render the semester blocks if an instance is selected */}
      {selectedAppliedSemester && (
        <div className="space-y-6">
          {coursesLoading ? (
            <div>Loading courses...</div>
          ) : (
            <SemesterCourseBlock
              key={selectedAppliedSemester.id}
              semesterId={selectedAppliedSemester.id}
              semesterNumber={selectedAppliedSemester.semesterNumber}
              courses={filteredCourses}
              departmentType={departmentType}
              programType={selectedAppliedSemester.programType}
              selectedCycle={appliedCycle}
              isBasicSciences={isBasicSciences}
              isSemesterLocked={isSemesterLocked}
            />
          )}
        </div>
      )}
    </div>
  );
};
