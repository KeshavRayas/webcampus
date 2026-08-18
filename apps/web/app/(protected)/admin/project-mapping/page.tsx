"use client";

import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { ProjectMappingListView } from "@/modules/department/project-mapping/project-mapping-list-view";
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

type AdminProjectMappingFilters = {
  departmentId: string;
  termId: string;
  semesterId: string;
};

const EMPTY_FILTERS: AdminProjectMappingFilters = {
  departmentId: "",
  termId: "",
  semesterId: "",
};

type Department = {
  id: string;
  name: string;
  code: string;
};

type RawSemester = {
  id: string;
  programType: string;
  semesterNumber: number;
};

export default function AdminProjectMappingPage() {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { data: terms } = useAcademicTerms();

  const [draftFilters, setDraftFilters] =
    useState<AdminProjectMappingFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AdminProjectMappingFilters>(EMPTY_FILTERS);

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["admin-departments"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<Department[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/department`,
        { withCredentials: true }
      );
      return res.data.status === "success" ? (res.data.data ?? []) : [];
    },
  });

  const { data: semesterOptions = [] } = useQuery<
    { id: string; label: string }[]
  >({
    queryKey: ["admin-semesters", draftFilters.termId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<RawSemester[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester/${draftFilters.termId}/semesters`,
        { withCredentials: true }
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
    departments: departments as { id: string }[],
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
    const first = departments[0];
    if (first) {
      setDraftFilters((prev) => ({
        ...prev,
        departmentId: prev.departmentId || first.id,
      }));
    }
  }, [departments]);

  useEffect(() => {
    const first = semesterOptions[0];
    if (draftFilters.termId && first) {
      setDraftFilters((prev) => ({
        ...prev,
        semesterId: prev.semesterId || first.id,
      }));
    }
  }, [draftFilters.termId, semesterOptions]);

  const filterFields = useMemo<FilterFieldConfig<AdminProjectMappingFilters>[]>(
    () => [
      {
        key: "departmentId",
        label: "Department",
        type: "select",
        options: departments.map((d) => ({
          value: d.id,
          label: `${d.code} — ${d.name}`,
        })),
        hideAllOption: true,
      },
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
    [departments, terms, semesterOptions, draftFilters.termId]
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

      {appliedFilters.semesterId && appliedFilters.departmentId ? (
        <ProjectMappingListView
          basePath="/admin"
          departmentId={appliedFilters.departmentId}
          semesterId={appliedFilters.semesterId}
        />
      ) : null}
    </div>
  );
}
