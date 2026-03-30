"use client";

import { useEffect } from "react";

export interface CascadingFilterOptions {
  academicTerms?: Array<{ id: string }>;
  semesters?: Array<{ id: string }>;
  departments?: Array<{ id: string }>;
}

/**
 * Hook to handle cascading filter dependencies and auto-clear orphaned filter values.
 * When a parent filter value is deleted (no longer exists in current options),
 * this hook will clear dependent child filters.
 *
 * @param filters - Current filter object (must be mutable state)
 * @param setFilters - State setter for filters
 * @param options - Available options for each filter
 */
export function useCascadingFilterSync<T extends Record<string, string>>(
  filters: T,
  setFilters: (updater: T | ((prev: T) => T)) => void,
  options: CascadingFilterOptions
) {
  useEffect(() => {
    const departmentFilterValue =
      (filters as any).departmentId || (filters as any).departmentName;

    // Check if selected academic term still exists
    if (
      filters.academicTerm &&
      options.academicTerms?.length &&
      !options.academicTerms.some((t) => t.id === filters.academicTerm)
    ) {
      setFilters((prev) => ({
        ...prev,
        academicTerm: "",
        semester: "",
        // Clear department if cascade deletion also affects it
        ...((prev as any).departmentId ? { departmentId: "" } : {}),
        ...((prev as any).departmentName ? { departmentName: "" } : {}),
      }));
      return;
    }

    // Check if selected semester still exists
    if (
      filters.semester &&
      options.semesters?.length &&
      !options.semesters.some((s) => s.id === filters.semester)
    ) {
      setFilters((prev) => ({
        ...prev,
        semester: "",
      }));
      return;
    }

    // Check if selected department still exists
    if (
      departmentFilterValue &&
      options.departments?.length &&
      !options.departments.some((d) => d.id === departmentFilterValue)
    ) {
      setFilters((prev) => ({
        ...prev,
        ...((prev as any).departmentId ? { departmentId: "" } : {}),
        ...((prev as any).departmentName ? { departmentName: "" } : {}),
      }));
      return;
    }
  }, [filters, setFilters, options.academicTerms, options.semesters, options.departments]);
}
