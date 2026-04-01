"use client";

import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { frontendEnv } from "@webcampus/common/env";
import { CourseResponseDTO, CourseMappingStatusItemType } from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import {
  FilterActions,
  FilterBuilder,
  FilterFieldConfig,
  FilterPanel,
} from "@webcampus/ui/components/filter-builder";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

export type CourseMappingFiltersState = {
  termId: string;
  semesterId: string;
  cycle: string;
  courseId: string;
  academicYear: string; // derived from term
};

const EMPTY_FILTERS: Omit<CourseMappingFiltersState, "academicYear"> = {
  termId: "",
  semesterId: "",
  cycle: "",
  courseId: "",
};

interface CourseMappingFiltersProps {
  deptInfo: { type: string; name: string } | null;
  appliedFilters: CourseMappingFiltersState | null;
  onAppliedFiltersChange: (filters: CourseMappingFiltersState | null) => void;
  onCourseSelect: (course: CourseResponseDTO | null) => void;
}

export const CourseMappingFilters = ({
  deptInfo,
  appliedFilters,
  onAppliedFiltersChange,
  onCourseSelect,
}: CourseMappingFiltersProps) => {
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
    const isFirstYearUgSemester = (s: { programType: string; semesterNumber: number }) =>
      s.programType === "UG" && FIRST_YEAR_UG_SEMESTERS.has(s.semesterNumber);

    if (!isBasicSciences) {
      return nestedSemesters.filter((s) => !isFirstYearUgSemester(s));
    }
    return nestedSemesters.filter((s) => isFirstYearUgSemester(s));
  }, [nestedSemesters, isBasicSciences]);

  // Initial setup effects
  useEffect(() => {
    if (isBasicSciences && !draftFilters.cycle) {
      setDraftFilters((cur) => ({ ...cur, cycle: BASIC_SCIENCES_CYCLE_OPTIONS[0] }));
    }
    if (!isBasicSciences && draftFilters.cycle) {
      setDraftFilters((cur) => ({ ...cur, cycle: "" }));
    }
  }, [draftFilters.cycle, isBasicSciences]);

  useEffect(() => {
    if (!draftFilters.termId && terms.length > 0) {
      const currentTerm = terms.find((t) => t.isCurrent) ?? terms[0];
      if (currentTerm) {
        setDraftFilters((cur) => ({ ...cur, termId: currentTerm.id }));
      }
    }
  }, [draftFilters.termId, terms]);

  useEffect(() => {
    if (draftFilters.termId && !draftFilters.semesterId && semesterOptions.length > 0) {
      setDraftFilters((cur) => ({ ...cur, semesterId: semesterOptions[0]!.id }));
    }
  }, [draftFilters.semesterId, draftFilters.termId, semesterOptions]);

  // Fetch courses with mapping status when semester is selected
  const { data: rawCourses, isLoading: loadingCourses } = useQuery({
    queryKey: [
      "course-mapping-status",
      draftFilters.semesterId,
      deptInfo?.name,
      selectedDraftTerm?.year,
      draftFilters.cycle,
    ],
    queryFn: async () => {
      if (!draftFilters.semesterId || !deptInfo?.name || !selectedDraftTerm?.year) return [];
      
      const res = await axios.get<BaseResponse<CourseMappingStatusItemType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/course-assignment/status`,
        {
          params: {
            semesterId: draftFilters.semesterId,
            departmentName: deptInfo.name,
            academicYear: selectedDraftTerm.year,
            ...(isBasicSciences && draftFilters.cycle ? { cycle: draftFilters.cycle } : {}),
          },
          withCredentials: true,
        }
      );
      if (res.data.status === "success" && res.data.data) return res.data.data;
      return [];
    },
    enabled: !!draftFilters.semesterId && !!deptInfo?.name && !!selectedDraftTerm?.year,
  });

  const courses = rawCourses ?? [];

  const applyFilters = async () => {
    if (!draftFilters.termId || !draftFilters.semesterId || !draftFilters.courseId) {
      return;
    }

    const term = terms.find((t) => t.id === draftFilters.termId);
    if (!term) return;

    // Fetch full course details to pass to the grid
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
      console.error("Failed to fetch course details", error);
      toast.error("Failed to load course details. Ensure the course data exists.");
    }
  };

  const resetFilters = () => {
    setDraftFilters({ ...EMPTY_FILTERS, termId: draftFilters.termId, semesterId: draftFilters.semesterId });
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
        label: `${t.type.charAt(0).toUpperCase() + t.type.slice(1)} ${t.year}`,
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
      placeholder: loadingCourses ? "Loading courses..." : "Select a course to map",
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
        onDraftChange={(key, value) => {
          setDraftFilters((cur) => {
            const next = { ...cur, [key]: value };
            if (key === "termId" || key === "semesterId" || key === "cycle") {
              next.courseId = ""; // reset course if upper level drops change
            }
            return next;
          });
        }}
        className="md:grid-cols-2 lg:grid-cols-4"
      />
      <div className="mt-4 flex justify-end">
        <FilterActions 
          onApply={applyFilters} 
          onReset={resetFilters} 
          applyLabel="Start Mapping"
        />
      </div>
    </FilterPanel>
  );
};
