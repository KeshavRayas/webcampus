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

type AdminElectiveMappingFilters = {
  departmentId: string;
  termId: string;
  semesterId: string;
};

const EMPTY_FILTERS: AdminElectiveMappingFilters = {
  departmentId: "",
  termId: "",
  semesterId: "",
};

export default function Page() {
  const { data: terms } = useAcademicTerms();
  const [draftFilters, setDraftFilters] =
    useState<AdminElectiveMappingFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AdminElectiveMappingFilters>(EMPTY_FILTERS);

  const { data: departments } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: async () => {
      const res =
        await apiClient.get<
          BaseResponse<{ id: string; name: string; code: string }[]>
        >(`/admin/department`);
      return res.data.status === "success" ? (res.data.data ?? []) : [];
    },
  });

  // Auto-select current/first term
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
    queryKey: ["admin-semesters", draftTermId],
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
  });

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: (terms ?? []) as { id: string }[],
    semesters: semesterOptions,
    departments,
  });

  // Auto-select first department + first semester
  useEffect(() => {
    if (!draftFilters.departmentId && departments && departments.length > 0) {
      setDraftFilters((prev) => ({
        ...prev,
        departmentId: departments[0]!.id,
      }));
    }
  }, [draftFilters.departmentId, departments]);

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

  const filterFields = useMemo<
    FilterFieldConfig<AdminElectiveMappingFilters>[]
  >(
    () => [
      {
        key: "departmentId",
        label: "Department",
        type: "select",
        placeholder: "Select department",
        hideAllOption: true,
        options: (departments ?? []).map((d) => ({
          label: `${d.code} — ${d.name}`,
          value: d.id,
        })),
      },
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
    [departments, terms, semesterOptions, draftFilters.termId]
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

      {appliedFilters.semesterId && appliedFilters.departmentId ? (
        <ElectiveMappingListView
          basePath="/admin"
          departmentId={appliedFilters.departmentId}
          semesterId={appliedFilters.semesterId}
        />
      ) : null}
    </div>
  );
}
