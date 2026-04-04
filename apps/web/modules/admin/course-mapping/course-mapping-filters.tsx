"use client";

import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  CourseMappingStatusItemType,
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
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

export type AdminCourseMappingFiltersState = {
  departmentName: string;
  termId: string;
  semesterId: string;
  cycle: string;
  courseId: string;
  academicYear: string;
};

const EMPTY_FILTERS: Omit<AdminCourseMappingFiltersState, "academicYear"> = {
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

  const { data: departments = [] } = useDepartments();
  const { data: rawTerms } = useAcademicTerms();
  const terms = rawTerms ?? [];

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

  const selectedDraftTerm = terms.find(
    (term) => term.id === draftFilters.termId
  );
  const nestedSemesters = selectedDraftTerm?.Semester ?? [];

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: nestedSemesters,
  });

  const semesterOptions = useMemo(() => {
    const isFirstYearUgSemester = (semester: {
      programType: string;
      semesterNumber: number;
    }) =>
      semester.programType === "UG" &&
      FIRST_YEAR_UG_SEMESTERS.has(semester.semesterNumber);

    if (isBasicSciences) {
      return nestedSemesters.filter((semester) =>
        isFirstYearUgSemester(semester)
      );
    }

    return nestedSemesters.filter(
      (semester) => !isFirstYearUgSemester(semester)
    );
  }, [isBasicSciences, nestedSemesters]);

  useEffect(() => {
    if (isBasicSciences && !draftFilters.cycle) {
      setDraftFilters((current) => ({
        ...current,
        cycle: BASIC_SCIENCES_CYCLE_OPTIONS[0],
      }));
    }

    if (!isBasicSciences && draftFilters.cycle) {
      setDraftFilters((current) => ({ ...current, cycle: "" }));
    }
  }, [draftFilters.cycle, isBasicSciences]);

  useEffect(() => {
    if (!draftFilters.termId && terms.length > 0) {
      const currentTerm = terms.find((term) => term.isCurrent) ?? terms[0];
      if (currentTerm) {
        setDraftFilters((current) => ({ ...current, termId: currentTerm.id }));
      }
    }
  }, [draftFilters.termId, terms]);

  useEffect(() => {
    if (
      draftFilters.termId &&
      !draftFilters.semesterId &&
      semesterOptions.length > 0
    ) {
      setDraftFilters((current) => ({
        ...current,
        semesterId: semesterOptions[0]!.id,
      }));
    }
  }, [draftFilters.semesterId, draftFilters.termId, semesterOptions]);

  const { data: rawCourses, isLoading: loadingCourses } = useQuery({
    queryKey: [
      "admin-course-mapping-status",
      draftFilters.departmentName,
      draftFilters.semesterId,
      selectedDraftTerm?.year,
      draftFilters.cycle,
    ],
    queryFn: async () => {
      if (
        !draftFilters.departmentName ||
        !draftFilters.semesterId ||
        !selectedDraftTerm?.year
      ) {
        return [];
      }

      const res = await axios.get<BaseResponse<CourseMappingStatusItemType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/course-assignment/status`,
        {
          params: {
            departmentName: draftFilters.departmentName,
            semesterId: draftFilters.semesterId,
            academicYear: selectedDraftTerm.year,
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
    enabled:
      !!draftFilters.departmentName &&
      !!draftFilters.semesterId &&
      !!selectedDraftTerm?.year,
  });

  const courses = rawCourses ?? [];

  const applyFilters = async () => {
    if (
      !draftFilters.departmentName ||
      !draftFilters.termId ||
      !draftFilters.semesterId ||
      !draftFilters.courseId
    ) {
      return;
    }

    const term = terms.find((item) => item.id === draftFilters.termId);
    if (!term) {
      return;
    }

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
    setDraftFilters({
      ...EMPTY_FILTERS,
      departmentName: draftFilters.departmentName,
      termId: draftFilters.termId,
      semesterId: draftFilters.semesterId,
      cycle: isBasicSciences ? draftFilters.cycle : "",
    });
    onAppliedFiltersChange(null);
    onCourseSelect(null);
  };

  const filterFields: FilterFieldConfig<typeof EMPTY_FILTERS>[] = [
    {
      key: "departmentName",
      label: "Department",
      type: "select",
      hideAllOption: true,
      options: departments.map((department) => ({
        label: department.name,
        value: department.name,
      })),
    },
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      hideAllOption: true,
      options: terms.map((term) => ({
        label: `${term.type.charAt(0).toUpperCase() + term.type.slice(1)} ${term.year}`,
        value: term.id,
      })),
    },
    {
      key: "semesterId",
      label: "Semester",
      type: "select",
      hideAllOption: true,
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
            hideAllOption: true,
            options: BASIC_SCIENCES_CYCLE_OPTIONS.map((cycle) => ({
              label: cycle,
              value: cycle,
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
            if (
              key === "departmentName" ||
              key === "termId" ||
              key === "semesterId" ||
              key === "cycle"
            ) {
              next.courseId = "";
            }
            if (key === "departmentName") {
              next.termId = "";
              next.semesterId = "";
              next.cycle = "";
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
