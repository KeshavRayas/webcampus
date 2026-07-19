"use client";

import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useDepartments } from "@/lib/use-departments";
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
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import axios from "axios";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

export type AdminCourseMappingFiltersState = {
  departmentId: string;
  departmentName: string;
  termId: string;
  semesterId: string;
  cycle: string;
  courseId: string;
  academicYear: string;
};

const EMPTY_FILTERS: Omit<AdminCourseMappingFiltersState, "academicYear"> = {
  departmentId: "",
  departmentName: "",
  termId: "",
  semesterId: "",
  cycle: "",
  courseId: "",
};

interface AdminCourseMappingFiltersProps {
  onAppliedFiltersChange: (
    filters: AdminCourseMappingFiltersState | null
  ) => void;
  onCourseSelect: (course: CourseResponseDTO | null) => void;
}

export const AdminCourseMappingFilters = ({
  onAppliedFiltersChange,
  onCourseSelect,
}: AdminCourseMappingFiltersProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);

  const { data: rawDepartments = [] } = useDepartments();
  const departments = rawDepartments.filter(
    (department) =>
      department.name !== "First Year" && department.type !== "SERVICE"
  );

  const firstYearDepartment = rawDepartments.find(
    (department) => department.name === "First Year"
  );

  const { data: rawTerms } = useAcademicTerms();
  const terms = rawTerms ?? [];

  const selectedDraftTerm = terms.find(
    (term) => term.id === draftFilters.termId
  );
  const semesters = selectedDraftTerm?.Semester ?? [];
  const selectedDraftSemester = semesters.find(
    (semester) => semester.id === draftFilters.semesterId
  );

  const isFirstYearUG =
    selectedDraftSemester?.programType == "UG" &&
    FIRST_YEAR_UG_SEMESTERS.has(selectedDraftSemester?.semesterNumber);

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: semesters,
  });

  // Default to current term
  useEffect(() => {
    if (!draftFilters.termId && terms.length > 0) {
      const currentTerm = terms.find((term) => term.isCurrent) ?? terms[0];
      setDraftFilters((current) => ({
        ...current,
        termId: currentTerm?.id ?? "",
      }));
    }
  }, [draftFilters.termId, terms]);

  // Default to the first semester of the term
  useEffect(() => {
    if (
      draftFilters.termId &&
      !draftFilters.semesterId &&
      semesters.length > 0
    ) {
      setDraftFilters((current) => ({
        ...current,
        semesterId: semesters[0]?.id ?? "",
      }));
    }
  }, [draftFilters.termId, draftFilters.semesterId, semesters]);

  // Handle First Year (Cycle) vs Higher Semesters (Branch) & ID Mapping
  useEffect(() => {
    if (isFirstYearUG && !draftFilters.cycle) {
      setDraftFilters((current) => ({
        ...current,
        cycle: BASIC_SCIENCES_CYCLE_OPTIONS[0],
        departmentName: "First Year",
        departmentId: firstYearDepartment?.id ?? "",
      }));
    } else if (
      !isFirstYearUG &&
      (!draftFilters.departmentName ||
        draftFilters.departmentName === "First Year") &&
      departments.length > 0
    ) {
      setDraftFilters((current) => ({
        ...current,
        cycle: "",
        departmentName: departments[0]?.name ?? "",
        departmentId: departments[0]?.id ?? "",
      }));
    }
  }, [
    isFirstYearUG,
    draftFilters.cycle,
    draftFilters.departmentName,
    departments,
    firstYearDepartment,
  ]);

  // Fetch courses dynamically based on Term/Semester/Cycle/Branch

  const { data: rawCourses, isLoading: loadingCourses } = useQuery({
    queryKey: [
      "admin-course-mapping-status",
      draftFilters.departmentId,
      draftFilters.semesterId,
      selectedDraftTerm?.year,
      draftFilters.cycle,
    ],
    queryFn: async () => {
      if (
        !draftFilters.departmentId ||
        !draftFilters.departmentName ||
        !draftFilters.semesterId ||
        !selectedDraftTerm?.year
      ) {
        return [];
      }

      const res = await axios.get<
        BaseResponse<CourseMappingStatusResponseType>
      >(`${NEXT_PUBLIC_API_BASE_URL}/admin/course-assignment/status`, {
        params: {
          departmentId: draftFilters.departmentId,
          departmentName: draftFilters.departmentName,
          semesterId: draftFilters.semesterId,
          academicYear: selectedDraftTerm.year,
          ...(isFirstYearUG && draftFilters.cycle
            ? { cycle: draftFilters.cycle }
            : {}),
        },
        withCredentials: true,
      });

      if (res.data.status == "success" && res.data.data?.courses) {
        return res.data.data.courses;
      }
      return [];
    },

    enabled:
      !!draftFilters.departmentId &&
      !!draftFilters.semesterId &&
      !!selectedDraftTerm?.year,
  });

  const courses = rawCourses ?? [];

  const applyFilters = async () => {
    if (
      !draftFilters.departmentId ||
      !draftFilters.termId ||
      !draftFilters.semesterId ||
      !draftFilters.courseId
    ) {
      return;
    }

    const term = terms.find((t) => t.id === draftFilters.termId);
    if (!term) return;

    try {
      const res = await axios.get<BaseResponse<CourseResponseDTO>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course/${draftFilters.courseId}`,
        { withCredentials: true }
      );

      if (res.data.status === "success" && res.data.data) {
        onCourseSelect(res.data.data);
        onAppliedFiltersChange({
          ...draftFilters,
          academicYear: term.year,
          cycle: isFirstYearUG ? draftFilters.cycle : "",
          departmentName: isFirstYearUG
            ? "First Year"
            : draftFilters.departmentName,
        });
      } else {
        toast.error(res.data.message || "Failed to load course details");
      }
    } catch (error) {
      console.error("Failed to fetch course details", error);
      toast.error("Failed to load course details.");
    }
  };

  const resetFilters = () => {
    setDraftFilters((current) => ({
      ...EMPTY_FILTERS,
      termId: current.termId,
      semesterId: current.semesterId,
      cycle: isFirstYearUG ? current.cycle : "",
      departmentName: isFirstYearUG
        ? "First Year"
        : (departments[0]?.name ?? ""),
      departmentId: isFirstYearUG
        ? (firstYearDepartment?.id ?? "")
        : (departments[0]?.id ?? ""),
    }));
    onAppliedFiltersChange(null);
    onCourseSelect(null);
  };

  const filterFields: FilterFieldConfig<typeof EMPTY_FILTERS>[] = [
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      hideAllOption: true,
      options: terms.map((term) => ({
        label: `${term.type.charAt(0).toUpperCase() + term.type.slice(1)}${term.year}`,
        value: term.id,
      })),
    },
    {
      key: "semesterId",
      label: "Semster",
      type: "select",
      hideAllOption: true,
      placeholder: draftFilters.termId
        ? "Select semester..."
        : "Select term first",
      options: semesters.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: semester.id,
      })),
    },
    ...(isFirstYearUG
      ? [
          {
            key: "cycle",
            label: "Cycle",
            type: "select",
            hideAllOption: true,
            options: BASIC_SCIENCES_CYCLE_OPTIONS.map((cycle) => ({
              label: cycle,
              value: cycle,
            })),
          } as FilterFieldConfig<typeof EMPTY_FILTERS>,
        ]
      : [
          {
            key: "departmentName",
            label: "Department (Branch)",
            type: "select",
            hideAllOption: true,
            options: departments.map((department) => ({
              label: department.name,
              value: department.name,
            })),
          } as FilterFieldConfig<typeof EMPTY_FILTERS>,
        ]),
    {
      key: "courseId",
      label: "Course",
      type: "select",
      hideAllOption: true,
      placeholder: loadingCourses ? "Loading Courses..." : "Select a course",
      options: courses.map((course) => ({
        label: `${course.code} - ${course.name} [${course.status}]`,
        value: course.courseId,
      })),
    },
  ];

  return (
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
              next.courseId = "";
            } else if (key === "semesterId") {
              next.cycle = "";
              next.courseId = "";
            } else if (key === "cycle" || key === "departmentName") {
              next.courseId = "";
            }

            if (key === "departmentName") {
              const selected = departments.find((d) => d.name === value);
              next.departmentId = selected?.id ?? "";
            }
            return next;
          });
        }}
        className="md:grid-cols-2 xl:grid-cols-5"
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
