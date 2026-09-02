"use client";

import { apiClient } from "@/lib/api-client";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import type { BaseResponse } from "@webcampus/types/api";
import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { useEffect, useMemo, useState } from "react";
import { ProjectMappingListView } from "./project-mapping-list-view";

type ProjectMappingFilters = {
  termId: string;
  semesterId: string;
};

const EMPTY_FILTERS: ProjectMappingFilters = {
  termId: "",
  semesterId: "",
};

type SemesterOption = {
  id: string;
  label: string;
};

type RawSemester = {
  id: string;
  programType: string;
  semesterNumber: number;
};

export function ProjectMappingDepartmentPage() {
  const { data: terms } = useAcademicTerms();

  const [draftFilters, setDraftFilters] =
    useState<ProjectMappingFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<ProjectMappingFilters>(EMPTY_FILTERS);

  const { data: semesterOptions = [] } = useQuery<SemesterOption[]>({
    queryKey: ["semesters-by-term", draftFilters.termId],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<RawSemester[]>>(
        `/admin/semester/${draftFilters.termId}/semesters`
      );
      const data = res.data.status === "success" ? (res.data.data ?? []) : [];
      return data.map((s) => ({
        id: s.id,
        label: `${s.programType} Sem ${s.semesterNumber}`,
      }));
    },
    enabled: Boolean(draftFilters.termId),
    retry: false,
  });

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: (terms ?? []) as { id: string }[],
    semesters: semesterOptions as { id: string }[],
  });

  useEffect(() => {
    if (terms && terms.length > 0) {
      const current = terms.find((t) => t.isCurrent) ?? terms[0];
      if (current) {
        setDraftFilters((prev) => ({
          ...prev,
          termId: prev.termId || current.id,
        }));
      }
    }
  }, [terms]);

  useEffect(() => {
    const first = semesterOptions[0];
    if (draftFilters.termId && first) {
      setDraftFilters((prev) => ({
        ...prev,
        semesterId: prev.semesterId || first.id,
      }));
    }
  }, [draftFilters.termId, semesterOptions]);

  useEffect(() => {
    if (
      draftFilters.termId &&
      draftFilters.semesterId &&
      !appliedFilters.semesterId
    ) {
      setAppliedFilters(draftFilters);
    }
  }, [draftFilters, appliedFilters.semesterId]);

  const filterFields = useMemo<FilterFieldConfig<ProjectMappingFilters>[]>(
    () => [
      {
        key: "termId",
        label: "Academic Term",
        type: "select",
        options: (terms ?? []).map((t) => ({
          value: t.id,
          label: `${t.type.toUpperCase()} ${t.year}`,
        })),
        hideAllOption: true,
      },
      {
        key: "semesterId",
        label: "Semester",
        type: "select",
        options: semesterOptions.map((s) => ({ value: s.id, label: s.label })),
        hideAllOption: true,
        placeholder: draftFilters.termId
          ? "Select semester"
          : "Select term first",
      },
    ],
    [terms, semesterOptions, draftFilters.termId]
  );

  const applyFilters = () => setAppliedFilters(draftFilters);
  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  return (
    <div className="space-y-8">
      <FilterPanel>
        <FilterBuilder
          fields={filterFields}
          draftFilters={draftFilters}
          onDraftChange={(key, value) =>
            setDraftFilters((prev) => ({ ...prev, [key]: value }))
          }
        />
        <FilterActions
          onApply={applyFilters}
          onReset={resetFilters}
          applyLabel="Apply Filters"
        />
      </FilterPanel>

      {appliedFilters.semesterId ? (
        <ProjectMappingListView
          basePath="/department"
          semesterId={appliedFilters.semesterId}
        />
      ) : null}
    </div>
  );
}
