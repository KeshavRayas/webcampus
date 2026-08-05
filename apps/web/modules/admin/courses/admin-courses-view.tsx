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
  departmentId: string;
  departmentName: string;
  termId: string;
  semesterId: string;
  cycle: string;
};

const EMPTY_FILTERS: AdminCoursesFilters = {
  departmentId: "",
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

  const { data: rawDepartments = [] } = useDepartments();
  const departments = rawDepartments.filter((d) => d.type !== "SERVICE");

  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];

  const selectedDraftTerm = terms.find(
    (term) => term.id === draftFilters.termId
  );
  const allSemestersForSelectedDraftTerm = selectedDraftTerm?.Semester ?? [];

  const firstYearDepartment = departments.find(
    (d) => d.type === "BASIC_SCIENCES"
  );

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: allSemestersForSelectedDraftTerm,
  });

  const semesterOptions = useMemo(() => {
    return allSemestersForSelectedDraftTerm;
  }, [allSemestersForSelectedDraftTerm]);

  const selectedDraftSemester = semesterOptions.find(
    (s) => s.id === draftFilters.semesterId
  );

  const isFirstYearUg =
    !!selectedDraftSemester &&
    FIRST_YEAR_UG_SEMESTERS.has(selectedDraftSemester.semesterNumber) &&
    selectedDraftSemester.programType === "UG";

  const isApplyReady =
    !!draftFilters.termId &&
    !!draftFilters.semesterId &&
    (isFirstYearUg ? !!draftFilters.cycle : !!draftFilters.departmentId);

  const selectedAppliedTerm = terms.find(
    (term) => term.id === appliedFilters.termId
  );
  const selectedAppliedSemester = (selectedAppliedTerm?.Semester || []).find(
    (semester) => semester.id === appliedFilters.semesterId
  );

  const appliedIsSemesterOneOrTwo =
    !!selectedAppliedSemester &&
    FIRST_YEAR_UG_SEMESTERS.has(selectedAppliedSemester.semesterNumber) &&
    selectedAppliedSemester.programType === "UG";

  const applyFilters = () => {
    if (!isApplyReady) return;

    const nextFilters: AdminCoursesFilters = {
      ...draftFilters,
      ...(isFirstYearUg && firstYearDepartment
        ? {
            departmentId: firstYearDepartment.id,
            departmentName: firstYearDepartment.name,
          }
        : {}),
      cycle: isFirstYearUg
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

  const courseFilterFields: FilterFieldConfig<AdminCoursesFilters>[] = [
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      options: terms.map((term) => ({
        label: `${term.type.charAt(0).toUpperCase() + term.type.slice(1)}${term.year}`,
        value: term.id,
      })),
      hideAllOption: true,
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
      hideAllOption: true,
    },
    ...(isFirstYearUg
      ? [
          {
            key: "cycle",
            label: "Cycle",
            type: "select",
            options: BASIC_SCIENCES_CYCLE_OPTIONS.map((cycle) => ({
              label: cycle,
              value: cycle,
            })),
            hideAllOption: true,
          } as FilterFieldConfig<AdminCoursesFilters>,
        ]
      : draftFilters.semesterId
        ? [
            {
              key: "departmentName",
              label: "Department",
              type: "select",
              options: departments
                .filter((d) => d.type !== "BASIC_SCIENCES")
                .map((department) => ({
                  label: department.name,
                  value: department.name,
                })),
              placeholder: draftFilters.semesterId
                ? "Select department..."
                : "Select semester first",
              hideAllOption: true,
            } as FilterFieldConfig<AdminCoursesFilters>,
          ]
        : []),
  ];

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: [
      "admin-courses",
      appliedFilters.departmentId,
      appliedFilters.departmentName,
      appliedFilters.semesterId,
      appliedFilters.cycle,
    ],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<CourseResponseDTO[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course/branch`,
        {
          params: {
            departmentId: appliedFilters.departmentId,
            departmentName: appliedFilters.departmentName,
            semesterId: appliedFilters.semesterId,
            ...(appliedIsSemesterOneOrTwo && appliedFilters.cycle
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
    enabled: !!appliedFilters.departmentId && !!appliedFilters.semesterId,
  });

  const appliedCycle =
    appliedIsSemesterOneOrTwo && appliedFilters.cycle
      ? (appliedFilters.cycle as CourseCycle)
      : "NONE";

  const filteredCourses = useMemo(() => {
    const courseList = courses ?? [];
    if (!appliedIsSemesterOneOrTwo || !appliedFilters.cycle) {
      return courseList;
    }

    return courseList.filter(
      (course) => (course.cycle ?? "NONE") === appliedCycle
    );
  }, [appliedCycle, appliedFilters.cycle, courses, appliedIsSemesterOneOrTwo]);

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
              add new courses. You can still edit existing ones — changes will
              be audited.
            </div>
          </div>
        </div>
      )}

      <FilterPanel>
        <FilterBuilder
          fields={courseFilterFields}
          draftFilters={draftFilters}
          onDraftChange={(key, value) => {
            setDraftFilters((current) => {
              const next = { ...current, [key]: value };

              if (key === "termId") {
                next.departmentName = "";
                next.departmentId = "";
                next.semesterId = "";
                next.cycle = "";
              } else if (key === "departmentName") {
                const selected = departments.find((d) => d.name === value);
                next.departmentId = selected?.id ?? "";
                next.cycle = "";
              } else if (key === "semesterId") {
                const semester = allSemestersForSelectedDraftTerm.find(
                  (s) => s.id === value
                );
                const isFirstYearUgSemester =
                  !!semester &&
                  FIRST_YEAR_UG_SEMESTERS.has(semester.semesterNumber) &&
                  semester.programType === "UG";

                if (isFirstYearUgSemester && firstYearDepartment) {
                  next.departmentId = firstYearDepartment.id;
                  next.departmentName = firstYearDepartment.name;
                } else {
                  next.departmentId = "";
                  next.departmentName = "";
                }
                next.cycle = "";
              }

              return next;
            });
          }}
          className="md:grid-cols-2 xl:grid-cols-4"
        />
        <FilterActions
          onApply={applyFilters}
          onReset={resetFilters}
          isApplyDisabled={!isApplyReady}
        />
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
              selectedDepartmentId={appliedFilters.departmentId}
              selectedDepartmentName={appliedFilters.departmentName}
              isBasicSciences={appliedIsSemesterOneOrTwo}
              isSemesterLocked={isSemesterLocked}
            />
          )}
        </div>
      )}
    </div>
  );
};
