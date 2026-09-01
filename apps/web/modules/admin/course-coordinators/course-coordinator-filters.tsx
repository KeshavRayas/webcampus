"use client";

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
  FilterFieldConfig,
  FilterPanel,
} from "@webcampus/ui/components/filter-builder";
import axios from "axios";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

export type CourseCoordinatorFiltersState = {
  departmentId: string;
  departmentName: string;
  termId: string;
  semesterId: string;
  cycle: string;
  courseId: string;
};

const EMPTY_FILTERS: CourseCoordinatorFiltersState = {
  departmentId: "",
  departmentName: "",
  termId: "",
  semesterId: "",
  cycle: "",
  courseId: "",
};

interface CourseCoordinatorFiltersProps {
  appliedFilters: CourseCoordinatorFiltersState | null;
  onAppliedFiltersChange: (
    filters: CourseCoordinatorFiltersState | null
  ) => void;
  onCourseSelect: (course: CourseResponseDTO | null) => void;
}

export const AdminCourseCoordinatorFilters = ({
  onAppliedFiltersChange,
  onCourseSelect,
}: CourseCoordinatorFiltersProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);

  const { data: rawTerms } = useAcademicTerms();
  const terms = rawTerms ?? [];

  const { data: rawDepartments = [] } = useDepartments();
  const departments = rawDepartments.filter((d) => d.type !== "SERVICE");

  const selectedDraftTerm = terms.find((t) => t.id === draftFilters.termId);
  const nestedSemesters = selectedDraftTerm?.Semester ?? [];

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: nestedSemesters,
  });

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
      nestedSemesters.length > 0
    ) {
      setDraftFilters((cur) => ({
        ...cur,
        semesterId: nestedSemesters[0]!.id,
      }));
    }
  }, [draftFilters.semesterId, draftFilters.termId, nestedSemesters]);

  const semesterOptions = nestedSemesters;

  // Fetch courses for admin (filtered by department)
  const { data: rawCourses, isLoading: loadingCourses } = useQuery({
    queryKey: [
      "admin-coordinator-courses",
      draftFilters.departmentId,
      draftFilters.semesterId,
      draftFilters.cycle,
    ],
    queryFn: async () => {
      if (!draftFilters.departmentId || !draftFilters.semesterId) return [];

      const res = await axios.get<BaseResponse<CourseResponseDTO[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course/branch`,
        {
          params: {
            departmentId: draftFilters.departmentId,
            semesterId: draftFilters.semesterId,
            ...(draftFilters.cycle ? { cycle: draftFilters.cycle } : {}),
          },
          withCredentials: true,
        }
      );
      if (res.data.status === "success" && res.data.data) {
        return res.data.data;
      }
      return [];
    },
    enabled: !!draftFilters.departmentId && !!draftFilters.semesterId,
  });

  const courses = rawCourses ?? [];

  const isApplyReady =
    !!draftFilters.termId &&
    !!draftFilters.departmentId &&
    !!draftFilters.semesterId &&
    !!draftFilters.courseId;

  const applyFilters = async () => {
    if (
      !draftFilters.departmentId ||
      !draftFilters.termId ||
      !draftFilters.semesterId ||
      !draftFilters.courseId
    ) {
      return;
    }

    try {
      const res = await axios.get<BaseResponse<CourseResponseDTO>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course/${draftFilters.courseId}`,
        {
          params: {
            departmentId: draftFilters.departmentId,
            departmentName: draftFilters.departmentName,
          },
          withCredentials: true,
        }
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
      key: "departmentId",
      label: "Department",
      type: "select",
      hideAllOption: true,
      placeholder: "Select a department",
      options: departments.map((d) => ({
        label: d.name,
        value: d.id,
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
            if (key === "termId") {
              next.semesterId = "";
              next.courseId = "";
            }
            if (key === "departmentId") {
              next.semesterId = "";
              next.courseId = "";
              next.departmentName =
                departments.find((d) => d.id === value)?.name ?? "";
            }
            if (key === "semesterId" || key === "cycle") {
              next.courseId = "";
            }
            return next;
          });
        }}
        action={
          <FilterActions
            onApply={applyFilters}
            onReset={resetFilters}
            isApplyDisabled={!isApplyReady}
            applyLabel="View Course"
          />
        }
      />
    </FilterPanel>
  );
};
