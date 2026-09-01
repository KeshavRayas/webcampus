"use client";

import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  CourseMappingStatusResponseType,
  CourseResponseDTO,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import {
  FilterActions,
  FilterBuilder,
  FilterFieldConfig,
  FilterPanel,
} from "@webcampus/ui/components/filter-builder";
import axios from "axios";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

export type CourseMappingFiltersState = {
  termId: string;
  semesterId: string;
  cycle: string;
  departmentId: string; // Used for the Branch filter
  courseId: string;
  academicYear: string;
};

const EMPTY_FILTERS: Omit<CourseMappingFiltersState, "academicYear"> = {
  termId: "",
  semesterId: "",
  cycle: "",
  departmentId: "",
  courseId: "",
};

interface CourseMappingFiltersProps {
  deptInfo: { type: string; name: string; id?: string } | null;
  appliedFilters: CourseMappingFiltersState | null;
  onAppliedFiltersChange: (filters: CourseMappingFiltersState | null) => void;
  onCourseSelect: (course: CourseResponseDTO | null) => void;
}

export const CourseMappingFilters = ({
  deptInfo,
  onAppliedFiltersChange,
  onCourseSelect,
}: CourseMappingFiltersProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);

  // Fetch academic terms
  const { data: rawTerms } = useAcademicTerms();
  const terms = rawTerms ?? [];

  const selectedDraftTerm = terms.find((t) => t.id === draftFilters.termId);
  const nestedSemesters = selectedDraftTerm?.Semester ?? [];

  // Fetch all departments for the Branch dropdown
  const { data: rawDepartments } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => {
      const res = await axios.get<
        BaseResponse<Array<{ id: string; name: string; type: string }>>
      >(`${NEXT_PUBLIC_API_BASE_URL}/department`, { withCredentials: true });
      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
  });
  const departments = rawDepartments ?? [];

  // Sync term/semester cascading drops
  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: nestedSemesters,
  });

  const selectedSemester = nestedSemesters.find(
    (s) => s.id === draftFilters.semesterId
  );

  const isFirstYearUg =
    selectedSemester?.programType === "UG" &&
    FIRST_YEAR_UG_SEMESTERS.has(selectedSemester?.semesterNumber);

  // Auto-select logic for initial load
  useEffect(() => {
    if (!draftFilters.termId && terms.length > 0) {
      const currentTerm = terms.find((t) => t.isCurrent) ?? terms[0];
      if (currentTerm) {
        setDraftFilters((cur) => ({ ...cur, termId: currentTerm.id }));
      }
    }
  }, [draftFilters.termId, terms]);

  // Clean up dependent filters when semester changes
  useEffect(() => {
    setDraftFilters((cur) => ({
      ...cur,
      cycle: isFirstYearUg ? BASIC_SCIENCES_CYCLE_OPTIONS[0] : "",
      departmentId: !isFirstYearUg ? deptInfo?.id || "" : "",
      courseId: "",
    }));
  }, [draftFilters.semesterId, isFirstYearUg, deptInfo?.id]);

  // Resolve active department name for API calls
  const activeDepartmentName = isFirstYearUg
    ? departments.find((d) => d.type === "BASIC_SCIENCES")?.name ||
      deptInfo?.name
    : departments.find((d) => d.id === draftFilters.departmentId)?.name ||
      deptInfo?.name;

  // Fetch courses with mapping status
  const { data: rawCourses, isLoading: loadingCourses } = useQuery({
    queryKey: [
      "course-mapping-status",
      draftFilters.semesterId,
      activeDepartmentName,
      selectedDraftTerm?.year,
      draftFilters.cycle,
    ],
    queryFn: async () => {
      if (
        !draftFilters.semesterId ||
        !activeDepartmentName ||
        !selectedDraftTerm?.year
      )
        return [];

      const res = await axios.get<
        BaseResponse<CourseMappingStatusResponseType>
      >(`${NEXT_PUBLIC_API_BASE_URL}/department/course-assignment/status`, {
        params: {
          semesterId: draftFilters.semesterId,
          departmentName: activeDepartmentName,
          academicYear: selectedDraftTerm.year,
          ...(isFirstYearUg && draftFilters.cycle
            ? { cycle: draftFilters.cycle }
            : {}),
        },
        withCredentials: true,
      });
      if (res.data.status === "success" && res.data.data?.courses) {
        return res.data.data.courses;
      }
      return [];
    },
    enabled:
      !!draftFilters.semesterId &&
      !!activeDepartmentName &&
      !!selectedDraftTerm?.year,
  });

  const courses = rawCourses ?? [];

  const applyFilters = async () => {
    if (
      !draftFilters.termId ||
      !draftFilters.semesterId ||
      !draftFilters.courseId
    ) {
      toast.error("Please fill all required filters before starting mapping.");
      return;
    }

    const term = terms.find((t) => t.id === draftFilters.termId);
    if (!term) return;

    try {
      const res = await axios.get<BaseResponse<CourseResponseDTO>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/${draftFilters.courseId}`,
        { withCredentials: true }
      );
      if (res.data.status === "success" && res.data.data) {
        onCourseSelect(res.data.data);
        onAppliedFiltersChange({
          ...draftFilters,
          academicYear: term.year,
        });
      } else {
        toast.error(res.data.message || "Failed to load course details");
      }
    } catch (error) {
      console.error(error);
      toast.error(
        "Failed to load course details. Ensure the course data exists."
      );
    }
  };

  const resetFilters = () => {
    setDraftFilters({
      ...EMPTY_FILTERS,
      termId: draftFilters.termId,
    });
    onAppliedFiltersChange(null);
    onCourseSelect(null);
  };

  const filterFields: FilterFieldConfig<typeof EMPTY_FILTERS>[] = [
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      hideAllOption: true,
      options: terms.map((t) => ({
        label: `${t.type.toUpperCase()} ${t.year}`,
        value: t.id,
      })),
    },
    {
      key: "semesterId",
      label: "Semester",
      type: "select",
      hideAllOption: true,
      options: nestedSemesters.map((s) => ({
        label: `${s.programType} - Semester ${s.semesterNumber}`,
        value: s.id,
      })),
    },
    ...(isFirstYearUg
      ? [
          {
            key: "cycle",
            label: "Cycle",
            type: "select",
            hideAllOption: true,
            options: BASIC_SCIENCES_CYCLE_OPTIONS.map((c) => ({
              label: c,
              value: c,
            })),
          } as FilterFieldConfig<typeof EMPTY_FILTERS>,
        ]
      : [
          {
            key: "departmentId",
            label: "Department",
            type: "select",
            hideAllOption: true,
            options: departments
              .filter((d) => d.type !== "BASIC_SCIENCES")
              .map((d) => ({
                label: d.name,
                value: d.id,
              })),
          } as FilterFieldConfig<typeof EMPTY_FILTERS>,
        ]),
    {
      key: "courseId",
      label: "Course",
      type: "select",
      hideAllOption: true,
      placeholder: loadingCourses
        ? "Loading courses..."
        : "Select a course to map",
      options: courses.map((c) => ({
        label: `${c.code} — ${c.name} [${c.status}]`,
        value: c.courseId,
      })),
    },
  ];

  return (
    <FilterPanel>
      <FilterBuilder
        fields={filterFields}
        draftFilters={draftFilters}
        className="[--filter-cols:3]"
        onDraftChange={(key, value) => {
          setDraftFilters((cur) => {
            const next = { ...cur, [key]: value };
            if (
              key === "termId" ||
              key === "semesterId" ||
              key === "cycle" ||
              key === "departmentId"
            ) {
              next.courseId = "";
            }
            return next;
          });
        }}
        action={
          <FilterActions
            onApply={applyFilters}
            onReset={resetFilters}
            applyLabel="Start Mapping"
          />
        }
      />
    </FilterPanel>
  );
};
