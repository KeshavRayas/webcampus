"use client";

import { apiClient } from "@/lib/api-client";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { ElectiveMappingListView } from "@/modules/department/elective-mapping/elective-mapping-list-view";
import { useQuery } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";
import {
  FilterActions,
  FilterBuilder,
  FilterFieldConfig,
  FilterPanel,
} from "@webcampus/ui/components/filter-builder";
import { useEffect, useMemo, useState } from "react";

type ElectiveMappingFilters = {
  termId: string;
  semesterId: string;
};

const EMPTY_FILTERS: ElectiveMappingFilters = {
  termId: "",
  semesterId: "",
};

export const ElectiveMappingDepartmentPage = () => {
  const { data: terms } = useAcademicTerms();
  const [draftFilters, setDraftFilters] =
    useState<ElectiveMappingFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<ElectiveMappingFilters>(EMPTY_FILTERS);

  // Auto-select current/first term so the page loads without interaction
  useEffect(() => {
    if (!draftFilters.termId && terms && terms.length > 0) {
      const current = terms.find((t) => t.isCurrent) ?? terms[0];
      if (current) {
        setDraftFilters((prev) => ({ ...prev, termId: current.id }));
      }
    }
  }, [draftFilters.termId, terms]);

  const draftTermId = draftFilters.termId;

  const { data: semesterOptions } = useQuery({
    queryKey: ["semesters-by-term", draftTermId],
    queryFn: async () => {
      const res = await apiClient.get<
        BaseResponse<
          { id: string; semesterNumber: number; programType: string }[]
        >
      >(`/admin/semester/${draftTermId}/semesters`);
      if (res.data.status !== "success") return [];
      return (res.data.data ?? []).map((s) => ({
        id: s.id,
        label: `${s.programType} Sem ${s.semesterNumber}`,
      }));
    },
    enabled: Boolean(draftTermId),
    retry: false,
  });

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: (terms ?? []) as { id: string }[],
    semesters: semesterOptions,
  });

  // Auto-select first semester of the chosen term
  useEffect(() => {
    if (
      draftFilters.termId &&
      !draftFilters.semesterId &&
      semesterOptions &&
      semesterOptions.length > 0
    ) {
      setDraftFilters((prev) => ({
        ...prev,
        semesterId: semesterOptions[0]!.id,
      }));
    }
  }, [draftFilters.termId, draftFilters.semesterId, semesterOptions]);

  // Auto-apply once both filters are populated so the page loads without interaction
  useEffect(() => {
    if (
      draftFilters.termId &&
      draftFilters.semesterId &&
      !appliedFilters.semesterId
    ) {
      setAppliedFilters(draftFilters);
    }
  }, [draftFilters, appliedFilters.semesterId]);

  const filterFields = useMemo<FilterFieldConfig<ElectiveMappingFilters>[]>(
    () => [
      {
        key: "termId",
        label: "Academic Term",
        type: "select",
        placeholder: "Select academic term",
        hideAllOption: true,
        options: (terms ?? []).map((t) => ({
          label: `${t.type.toUpperCase()} ${t.year}`,
          value: t.id,
        })),
      },
      {
        key: "semesterId",
        label: "Semester",
        type: "select",
        placeholder: draftFilters.termId
          ? "Select semester"
          : "Select term first",
        hideAllOption: true,
        options: (semesterOptions ?? []).map((s) => ({
          label: s.label,
          value: s.id,
        })),
      },
    ],
    [terms, semesterOptions, draftFilters.termId]
  );

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
  };

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
        <FilterActions onApply={applyFilters} onReset={resetFilters} />
      </FilterPanel>

      {appliedFilters.semesterId ? (
        <ElectiveMappingListView
          basePath="/department"
          semesterId={appliedFilters.semesterId}
        />
      ) : null}
    </div>
  );
};
