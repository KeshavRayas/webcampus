"use client";

import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import type { AdminCourseMappingFiltersState } from "./course-mapping-view";

interface AdminCourseMappingFiltersProps {
  draftFilters: AdminCourseMappingFiltersState;
  filterFields: FilterFieldConfig<AdminCourseMappingFiltersState>[];
  onDraftChange: (key: string, value: string) => void;
  isApplyReady: boolean;
  onApply: () => void;
  onReset: () => void;
}

export const AdminCourseMappingFilters = ({
  draftFilters,
  filterFields,
  onDraftChange,
  isApplyReady,
  onApply,
  onReset,
}: AdminCourseMappingFiltersProps) => {
  return (
    <FilterPanel>
      <FilterBuilder
        fields={filterFields}
        draftFilters={draftFilters}
        onDraftChange={onDraftChange}
        action={
          <FilterActions
            onApply={onApply}
            onReset={onReset}
            isApplyDisabled={!isApplyReady}
            applyLabel="Start Mapping"
          />
        }
      />
    </FilterPanel>
  );
};
