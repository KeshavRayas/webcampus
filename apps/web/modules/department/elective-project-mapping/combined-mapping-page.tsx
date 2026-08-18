"use client";

import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import type { BaseResponse } from "@webcampus/types/api";
import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { CombinedMappingListView } from "./combined-mapping-list-view";

type CombinedMappingFilters = {
  departmentId: string;
  termId: string;
  semesterId: string;
};

const EMPTY_FILTERS: CombinedMappingFilters = {
  departmentId: "",
  termId: "",
  semesterId: "",
};

type SemesterOption = {
  id: string;
  label: string;
};

export function CombinedMappingPage({
  basePath,
}: {
  basePath: "/department" | "/admin";
}) {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { data: terms } = useAcademicTerms();
  const isAdmin = basePath === "/admin";

  const [draftFilters, setDraftFilters] =
    useState<CombinedMappingFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<CombinedMappingFilters>(EMPTY_FILTERS);

  const { data: departments } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: async () => {
      const res = await axios.get<
        BaseResponse<{ id: string; name: string; code: string }[]>
      >(`${NEXT_PUBLIC_API_BASE_URL}/admin/department`, {
        withCredentials: true,
      });
      return res.data.status === "success" ? (res.data.data ?? []) : [];
    },
    enabled: isAdmin,
  });

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

  const { data: semesterOptions = [] } = useQuery<SemesterOption[]>({
    queryKey: ["semesters-by-term", draftTermId],
    queryFn: async () => {
      const res = await axios.get<
        BaseResponse<
          { id: string; semesterNumber: number; programType: string }[]
        >
      >(`${NEXT_PUBLIC_API_BASE_URL}/admin/semester/${draftTermId}/semesters`, {
        withCredentials: true,
      });
      const data = res.data.status === "success" ? (res.data.data ?? []) : [];
      return data.map((s) => ({
        id: s.id,
        label: `${s.programType} Sem ${s.semesterNumber}`,
      }));
    },
    enabled: Boolean(draftTermId),
    retry: false,
  });

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: (terms ?? []) as { id: string }[],
    semesters: semesterOptions as { id: string }[],
    departments: (departments ?? []) as { id: string }[],
  });

  // Auto-select first department (admin only)
  useEffect(() => {
    if (
      isAdmin &&
      !draftFilters.departmentId &&
      departments &&
      departments.length > 0
    ) {
      setDraftFilters((prev) => ({
        ...prev,
        departmentId: departments[0]!.id,
      }));
    }
  }, [isAdmin, draftFilters.departmentId, departments]);

  // Auto-select first semester of the chosen term
  useEffect(() => {
    const first = semesterOptions[0];
    if (draftFilters.termId && first) {
      setDraftFilters((prev) => ({
        ...prev,
        semesterId: prev.semesterId || first.id,
      }));
    }
  }, [draftFilters.termId, semesterOptions]);

  // Auto-apply once both filters are populated so the page loads without interaction
  useEffect(() => {
    if (
      draftFilters.termId &&
      draftFilters.semesterId &&
      (!isAdmin || draftFilters.departmentId) &&
      !appliedFilters.semesterId
    ) {
      setAppliedFilters(draftFilters);
    }
  }, [draftFilters, appliedFilters.semesterId, isAdmin]);

  const filterFields = useMemo<FilterFieldConfig<CombinedMappingFilters>[]>(
    () => [
      ...(isAdmin
        ? [
            {
              key: "departmentId" as const,
              label: "Department",
              type: "select" as const,
              placeholder: "Select department",
              hideAllOption: true,
              options: (departments ?? []).map((d) => ({
                label: `${d.code} — ${d.name}`,
                value: d.id,
              })),
            },
          ]
        : []),
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
        options: semesterOptions.map((s) => ({ value: s.id, label: s.label })),
      },
    ],
    [isAdmin, departments, terms, semesterOptions, draftFilters.termId]
  );

  const applyFilters = () => setAppliedFilters(draftFilters);
  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const listReady =
    Boolean(appliedFilters.semesterId) &&
    (basePath === "/department" || Boolean(appliedFilters.departmentId));

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

      {listReady ? (
        <CombinedMappingListView
          basePath={basePath}
          departmentId={appliedFilters.departmentId || undefined}
          semesterId={appliedFilters.semesterId}
        />
      ) : null}
    </div>
  );
}
