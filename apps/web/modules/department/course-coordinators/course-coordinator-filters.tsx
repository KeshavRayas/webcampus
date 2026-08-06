"use client";

import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { CourseResponseDTO } from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import {
  FilterActions,
  FilterBuilder,
  FilterFieldConfig,
  FilterPanel,
} from "@webcampus/ui/components/filter-builder";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

export type CourseCoordinatorFiltersState = {
  termId: string;
  semesterId: string;
  cycle: string;
  courseId: string;
};

const EMPTY_FILTERS: CourseCoordinatorFiltersState = {
  termId: "",
  semesterId: "",
  cycle: "",
  courseId: "",
};

interface CourseCoordinatorFiltersProps {
  deptInfo: { type: string; name: string } | null;
  appliedFilters: CourseCoordinatorFiltersState | null;
  onAppliedFiltersChange: (
    filters: CourseCoordinatorFiltersState | null
  ) => void;
  onCourseSelect: (course: CourseResponseDTO | null) => void;
}

export const CourseCoordinatorFilters = ({
  deptInfo,
  onAppliedFiltersChange,
  onCourseSelect,
}: CourseCoordinatorFiltersProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const isBasicSciences = deptInfo?.type === "BASIC_SCIENCES";

  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);

  // Fetch academic terms
  const { data: rawTerms } = useAcademicTerms();
  const terms = rawTerms ?? [];

  const selectedDraftTerm = terms.find((t) => t.id === draftFilters.termId);
  const nestedSemesters = selectedDraftTerm?.Semester ?? [];

  // Sync term/semester cascading drops
  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: nestedSemesters,
  });

  const semesterOptions = useMemo(() => {
    const isFirstYearUgSemester = (s: {
      programType: string;
      semesterNumber: number;
    }) =>
      s.programType === "UG" && FIRST_YEAR_UG_SEMESTERS.has(s.semesterNumber);

    if (!isBasicSciences) {
      return nestedSemesters.filter((s) => !isFirstYearUgSemester(s));
    }
    return nestedSemesters.filter((s) => isFirstYearUgSemester(s));
  }, [nestedSemesters, isBasicSciences]);

  // Auto-select current term
  useEffect(() => {
    if (!draftFilters.termId && terms.length > 0) {
      const currentTerm = terms.find((t) => t.isCurrent) ?? terms[0];
      if (currentTerm) {
        setDraftFilters((cur) => ({ ...cur, termId: currentTerm.id }));
      }
    }
  }, [draftFilters.termId, terms]);

  // Auto-select first semester
  useEffect(() => {
    if (
      draftFilters.termId &&
      !draftFilters.semesterId &&
      semesterOptions.length > 0
    ) {
      setDraftFilters((cur) => ({
        ...cur,
        semesterId: semesterOptions[0]!.id,
      }));
    }
  }, [draftFilters.semesterId, draftFilters.termId, semesterOptions]);

  // Auto-select cycle for BASIC_SCIENCES
  useEffect(() => {
    if (isBasicSciences && !draftFilters.cycle) {
      setDraftFilters((cur) => ({
        ...cur,
        cycle: BASIC_SCIENCES_CYCLE_OPTIONS[0],
      }));
    }
    if (!isBasicSciences && draftFilters.cycle) {
      setDraftFilters((cur) => ({ ...cur, cycle: "" }));
    }
  }, [draftFilters.cycle, isBasicSciences]);

  // Fetch courses for the selected semester
  const { data: rawCourses, isLoading: loadingCourses } = useQuery({
    queryKey: [
      "coordinator-courses",
      draftFilters.semesterId,
      draftFilters.cycle,
    ],
    queryFn: async () => {
      if (!draftFilters.semesterId) return [];

      const res = await axios.get<BaseResponse<CourseResponseDTO[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/branch`,
        {
          params: {
            semesterId: draftFilters.semesterId,
            ...(isBasicSciences && draftFilters.cycle
              ? { cycle: draftFilters.cycle }
              : {}),
          },
          withCredentials: true,
        }
      );
      if (res.data.status === "success" && res.data.data) {
        return res.data.data;
      }
      return [];
    },
    enabled: !!draftFilters.semesterId,
  });

  const courses = rawCourses ?? [];

  const applyFilters = async () => {
    if (
      !draftFilters.termId ||
      !draftFilters.semesterId ||
      !draftFilters.courseId
    ) {
      return;
    }

    try {
      const res = await axios.get<BaseResponse<CourseResponseDTO>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course/${draftFilters.courseId}`,
        { withCredentials: true }
      );
      if (res.data.status === "success" && res.data.data) {
        onCourseSelect(res.data.data);
        onAppliedFiltersChange({ ...draftFilters });
      } else {
        toast.error(res.data.message || "Failed to load course details");
      }
    } catch (error) {
      console.error("Failed to fetch course details", error);
      toast.error(
        "Failed to load course details. Ensure the course data exists."
      );
    }
  };

  const resetFilters = () => {
    setDraftFilters({
      ...EMPTY_FILTERS,
      termId: draftFilters.termId,
      semesterId: draftFilters.semesterId,
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
      options: semesterOptions.map((s) => ({
        label: `${s.programType} - Semester ${s.semesterNumber}`,
        value: s.id,
      })),
    },
    ...(isBasicSciences
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
      : []),
    {
      key: "courseId",
      label: "Course",
      type: "select",
      hideAllOption: true,
      placeholder: loadingCourses ? "Loading courses..." : "Select a course",
      options: courses.map((c) => ({
        label: `${c.code} — ${c.name}`,
        value: c.id,
      })),
    },
  ];

  return (
    <FilterPanel>
      <FilterBuilder
        fields={filterFields}
        draftFilters={draftFilters}
        onDraftChange={(key, value) => {
          setDraftFilters((cur) => {
            const next = { ...cur, [key]: value };
            if (key === "termId" || key === "semesterId" || key === "cycle") {
              next.courseId = "";
            }
            return next;
          });
        }}
      />
      <div className="mt-4 flex justify-end">
        <FilterActions
          onApply={applyFilters}
          onReset={resetFilters}
          applyLabel="View Course"
        />
      </div>
    </FilterPanel>
  );
};
