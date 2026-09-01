"use client";

import { AdmissionFilterBar } from "@/modules/admission/shared/admission-filter-bar";
import type { FilterFieldConfig } from "@webcampus/ui/components/filter-builder";
import { useState } from "react";

type FilterState = {
  academicTerm: string;
  semester: string;
};

const EMPTY_FILTERS: FilterState = {
  academicTerm: "",
  semester: "",
};

const fields: FilterFieldConfig<FilterState>[] = [
  {
    key: "academicTerm",
    label: "Academic Term",
    type: "select",
    placeholder: "All terms",
    allOptionLabel: "All terms",
    options: [{ label: "TERM 2026 · ODD SEMESTER", value: "2026-odd" }],
  },
  {
    key: "semester",
    label: "Semester",
    type: "select",
    placeholder: "All semesters",
    allOptionLabel: "All semesters",
    options: [
      { label: "Semester 1", value: "1" },
      { label: "Semester 3", value: "3" },
      { label: "Semester 5", value: "5" },
      { label: "Semester 7", value: "7" },
    ],
  },
];

export function AdmissionTabFilterStrip() {
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);

  return (
    <AdmissionFilterBar
      simpleFields={fields}
      advancedFields={[]}
      draftFilters={draftFilters}
      onDraftChange={(key, value) =>
        setDraftFilters((current) => ({ ...current, [key]: value }))
      }
      onApply={() => undefined}
      onReset={() => setDraftFilters(EMPTY_FILTERS)}
      showFieldToggles={false}
    />
  );
}
