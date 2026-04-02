"use client";

import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import {
  FilterActions,
  FilterBuilder,
  FilterFieldConfig,
  FilterPanel,
} from "@webcampus/ui/components/filter-builder";
import { useEffect, useMemo, useState } from "react";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

export type CourseApprovalsFiltersState = {
  termId: string;
  semesterId: string;
  cycle: string;
  academicYear: string;
};

const EMPTY_FILTERS: Omit<CourseApprovalsFiltersState, "academicYear"> = {
  termId: "",
  semesterId: "",
  cycle: "",
};

interface CourseApprovalsFiltersProps {
  deptInfo: { type: string; name: string } | null;
  onAppliedFiltersChange: (filters: CourseApprovalsFiltersState | null) => void;
}

export const CourseApprovalsFilters = ({
  deptInfo,
  onAppliedFiltersChange,
}: CourseApprovalsFiltersProps) => {
  const isBasicSciences = deptInfo?.type === "BASIC_SCIENCES";
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);

  const { data: rawTerms } = useAcademicTerms();
  const terms = rawTerms ?? [];

  const selectedDraftTerm = terms.find((t) => t.id === draftFilters.termId);
  const nestedSemesters = selectedDraftTerm?.Semester ?? [];

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

  useEffect(() => {
    if (!draftFilters.termId && terms.length > 0) {
      const currentTerm = terms.find((t) => t.isCurrent) ?? terms[0];
      if (currentTerm) {
        setDraftFilters((cur) => ({ ...cur, termId: currentTerm.id }));
      }
    }
  }, [draftFilters.termId, terms]);

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

  const applyFilters = () => {
    if (!draftFilters.termId || !draftFilters.semesterId) {
      return;
    }
    const term = terms.find((t) => t.id === draftFilters.termId);
    if (!term) return;

    onAppliedFiltersChange({
      ...draftFilters,
      academicYear: term.year,
    });
  };

  const resetFilters = () => {
    setDraftFilters({
      ...EMPTY_FILTERS,
      termId: draftFilters.termId,
      semesterId: draftFilters.semesterId,
    });
    onAppliedFiltersChange(null);
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
  ];

  return (
    <FilterPanel>
      <FilterBuilder
        fields={filterFields}
        draftFilters={draftFilters}
        onDraftChange={(key, value) => {
          setDraftFilters((cur) => ({ ...cur, [key]: value }));
        }}
        className="md:grid-cols-2 lg:grid-cols-3"
      />
      <div className="mt-4 flex justify-end">
        <FilterActions
          onApply={applyFilters}
          onReset={resetFilters}
          applyLabel="View Approvals"
        />
      </div>
    </FilterPanel>
  );
};
