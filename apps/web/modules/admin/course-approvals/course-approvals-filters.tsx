"use client";

import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { useMemo } from "react";
import { GroupedCourse } from "./course-approvals-view";

interface CourseApprovalsFiltersProps {
  groups: GroupedCourse[];
  draftFilters: Record<string, string>;
  appliedFilters: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
  onApply: () => void;
  onReset: () => void;
}

export const CourseApprovalsFilters = ({
  groups,
  draftFilters,
  onDraftChange,
  onApply,
  onReset,
}: CourseApprovalsFiltersProps) => {
  const termOptions = useMemo(() => {
    const seen = new Set<string>();
    return groups
      .flatMap((g) => {
        const term = g.semester?.academicTerm;
        return term ? [term] : [];
      })
      .filter((t) => {
        const key = `${t.type}_${t.year}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((t) => ({
        label: `${t.type.toUpperCase()} ${t.year}`,
        value: `${t.type}_${t.year}`,
      }));
  }, [groups]);

  const selectedTerm = draftFilters.termId
    ? draftFilters.termId.split("_")
    : null;

  const semesterOptions = useMemo(() => {
    if (!selectedTerm) return [];
    const [type, year] = selectedTerm;
    const seen = new Set<number>();
    return groups
      .filter(
        (g) =>
          g.semester?.academicTerm?.type === type &&
          g.semester?.academicTerm?.year === year
      )
      .map((g) => g.semester.semesterNumber)
      .filter((n) => {
        if (seen.has(n)) return false;
        seen.add(n);
        return true;
      })
      .sort((a, b) => a - b)
      .map((n) => ({
        label: `Semester ${n}`,
        value: String(n),
      }));
  }, [groups, selectedTerm]);

  const departmentOptions = useMemo(() => {
    const seen = new Set<string>();
    return groups
      .filter((g) => g.departmentName)
      .map((g) => g.departmentName)
      .filter((name) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .sort()
      .map((name) => ({
        label: name,
        value: name,
      }));
  }, [groups]);

  const cycleOptions = useMemo(() => {
    const seen = new Set<string>();
    return groups
      .filter((g) => g.cycle && g.cycle !== "NONE")
      .map((g) => g.cycle)
      .filter((c) => {
        if (seen.has(c)) return false;
        seen.add(c);
        return true;
      })
      .map((c) => ({
        label: c,
        value: c,
      }));
  }, [groups]);

  const statusOptions = [
    { label: "All statuses", value: "" },
    { label: "Draft", value: "DRAFT" },
    { label: "Pending", value: "PENDING" },
    { label: "Approved", value: "APPROVED" },
    { label: "Needs Revision", value: "NEEDS_REVISION" },
  ];

  const filterFields: FilterFieldConfig<Record<string, string>>[] = [
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      options: termOptions,
      placeholder: "All terms",
    },
    {
      key: "semesterId",
      label: "Semester",
      type: "select",
      options: semesterOptions,
      placeholder: draftFilters.termId ? "All semesters" : "Select term first",
    },
    ...(cycleOptions.length > 0
      ? [
          {
            key: "cycle",
            label: "Cycle",
            type: "select",
            options: cycleOptions,
            placeholder: "All cycles",
          } as FilterFieldConfig<Record<string, string>>,
        ]
      : []),
    {
      key: "departmentName",
      label: "Department",
      type: "select",
      options: departmentOptions,
      placeholder: "All departments",
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: statusOptions,
      placeholder: "All statuses",
    },
  ];

  return (
    <FilterPanel>
      <FilterBuilder
        fields={filterFields}
        draftFilters={draftFilters}
        onDraftChange={onDraftChange}
      />
      <FilterActions onApply={onApply} onReset={onReset} />
    </FilterPanel>
  );
};
