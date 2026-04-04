"use client";

import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useDepartments } from "@/lib/use-departments";
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
import { useEffect, useMemo, useState } from "react";
import { AdminSemesterCourseBlock } from "./admin-semester-course-block";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

type CourseCycle = "PHYSICS" | "CHEMISTRY" | "NONE";

type AdminCoursesFilters = {
  departmentName: string;
  termId: string;
  semesterId: string;
  cycle: string;
};

const EMPTY_FILTERS: AdminCoursesFilters = {
  departmentName: "",
  termId: "",
  semesterId: "",
  cycle: "",
};

export const AdminCoursesView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [draftFilters, setDraftFilters] = useState<AdminCoursesFilters>(() =>
    getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );
  const [appliedFilters, setAppliedFilters] = useState<AdminCoursesFilters>(
    () => getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
  );

  useEffect(() => {
    const nextFilters = getFiltersFromSearchParams(searchParams, EMPTY_FILTERS);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams]);

  const { data: departments = [] } = useDepartments();
  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];

  useEffect(() => {
    if (draftFilters.departmentName || departments.length === 0) {
      return;
    }

    setDraftFilters((current) => ({
      ...current,
      departmentName: departments[0]!.name,
    }));
  }, [departments, draftFilters.departmentName]);

  const selectedDepartment = departments.find(
    (department) => department.name === draftFilters.departmentName
  );
  const isBasicSciences = selectedDepartment?.type === "BASIC_SCIENCES";

  useEffect(() => {
    if (isBasicSciences && !draftFilters.cycle) {
      setDraftFilters((current) => ({
        ...current,
        cycle: BASIC_SCIENCES_CYCLE_OPTIONS[0],
      }));
      return;
    }

    if (!isBasicSciences && draftFilters.cycle) {
      setDraftFilters((current) => ({ ...current, cycle: "" }));
    }
  }, [draftFilters.cycle, isBasicSciences]);

  const selectedDraftTerm = terms.find(
    (term) => term.id === draftFilters.termId
  );
  const allSemestersForSelectedDraftTerm = selectedDraftTerm?.Semester ?? [];

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

    if (isBasicSciences) {
      return allSemestersForSelectedDraftTerm.filter((semester) =>
        isFirstYearUgSemester(semester)
      );
    }

    return allSemestersForSelectedDraftTerm.filter(
      (semester) => !isFirstYearUgSemester(semester)
    );
  }, [allSemestersForSelectedDraftTerm, isBasicSciences]);

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

    if (semesterOptions.length > 0) {
      setDraftFilters((current) => ({
        ...current,
        semesterId: semesterOptions[0]!.id,
      }));
    }
  }, [draftFilters.semesterId, draftFilters.termId, semesterOptions]);

  useEffect(() => {
    if (!draftFilters.semesterId) {
      return;
    }

    const isSelectedSemesterAllowed = semesterOptions.some(
      (semester) => semester.id === draftFilters.semesterId
    );

    if (!isSelectedSemesterAllowed) {
      setDraftFilters((current) => ({ ...current, semesterId: "" }));
    }
  }, [draftFilters.semesterId, semesterOptions]);

  useEffect(() => {
    if (appliedFilters.termId && appliedFilters.semesterId) {
      return;
    }

    if (
      !draftFilters.termId ||
      !draftFilters.semesterId ||
      !draftFilters.departmentName
    ) {
      return;
    }

    setAppliedFilters({
      ...draftFilters,
      cycle: isBasicSciences
        ? draftFilters.cycle || BASIC_SCIENCES_CYCLE_OPTIONS[0]
        : "",
    });
  }, [
    appliedFilters.semesterId,
    appliedFilters.termId,
    draftFilters,
    isBasicSciences,
  ]);

  const selectedAppliedTerm = terms.find(
    (term) => term.id === appliedFilters.termId
  );
  const selectedAppliedSemester = (selectedAppliedTerm?.Semester || []).find(
    (semester) => semester.id === appliedFilters.semesterId
  );

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

  const courseFilterFields: FilterFieldConfig<AdminCoursesFilters>[] = [
    {
      key: "departmentName",
      label: "Department",
      type: "select",
      options: departments.map((department) => ({
        label: department.name,
        value: department.name,
      })),
      allOptionLabel: "All departments",
      hideAllOption: true,
    },
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      options: terms.map((term) => ({
        label: `${term.type.charAt(0).toUpperCase() + term.type.slice(1)} ${term.year}`,
        value: term.id,
      })),
      allOptionLabel: "All terms",
    },
    {
      key: "semesterId",
      label: "Semester",
      type: "select",
      options: semesterOptions.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: semester.id,
      })),
      placeholder: draftFilters.termId
        ? "Select semester..."
        : "Select term first",
      allOptionLabel: "All semesters",
    },
    ...(isBasicSciences
      ? [
          {
            key: "cycle",
            label: "Cycle",
            type: "select",
            options: BASIC_SCIENCES_CYCLE_OPTIONS.map((cycle) => ({
              label: cycle,
              value: cycle,
            })),
            allOptionLabel: "All cycles",
          } as FilterFieldConfig<AdminCoursesFilters>,
        ]
      : []),
  ];

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: [
      "admin-courses",
      appliedFilters.departmentName,
      appliedFilters.semesterId,
      appliedFilters.cycle,
    ],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<CourseResponseDTO[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course/branch`,
        {
          params: {
            departmentName: appliedFilters.departmentName,
            semesterId: appliedFilters.semesterId,
            ...(isBasicSciences && appliedFilters.cycle
              ? { cycle: appliedFilters.cycle }
              : {}),
          },
          withCredentials: true,
        }
      );

      if (res.data.status === "success") {
        return res.data.data;
      }

      return [];
    },
    enabled: !!appliedFilters.departmentName && !!appliedFilters.semesterId,
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
      (course) =>
        course.approvalStatus === "PENDING" ||
        course.approvalStatus === "APPROVED"
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
            if (key === "departmentName") {
              setDraftFilters((current) => ({
                ...current,
                departmentName: value,
                semesterId: "",
                cycle: "",
              }));
              return;
            }

            if (key === "termId") {
              setDraftFilters((current) => ({
                ...current,
                termId: value,
                semesterId: "",
              }));
              return;
            }

            setDraftFilters((current) => ({ ...current, [key]: value }));
          }}
          allValue={DEFAULT_FILTER_ALL_VALUE}
          className="md:grid-cols-2 xl:grid-cols-4"
        />
        <FilterActions onApply={applyFilters} onReset={resetFilters} />
      </FilterPanel>

      {selectedAppliedSemester && (
        <div className="space-y-6">
          {coursesLoading ? (
            <div>Loading courses...</div>
          ) : (
            <AdminSemesterCourseBlock
              key={`${selectedAppliedSemester.id}_${appliedFilters.departmentName}`}
              semesterId={selectedAppliedSemester.id}
              semesterNumber={selectedAppliedSemester.semesterNumber}
              courses={filteredCourses}
              selectedCycle={appliedCycle}
              selectedDepartmentName={appliedFilters.departmentName}
              isBasicSciences={isBasicSciences}
              isSemesterLocked={isSemesterLocked}
            />
          )}
        </div>
      )}
    </div>
  );
};
