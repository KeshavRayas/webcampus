"use client";

import { MarksReportTable } from "@/components/academics/reports/marks-tables";
import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { useMemo } from "react";
import type { MarksReportData, MarksReportFilters } from "./marks-report-types";

interface SelectOption {
  value: string;
  label: string;
}

interface MarksReportShellProps {
  draftFilters: MarksReportFilters;
  onDraftChange: (key: string, value: string) => void;
  academicTerms: SelectOption[];
  programTypes: SelectOption[];
  semesters: SelectOption[];
  courses: SelectOption[];
  sections: SelectOption[];
  hasRequiredFilters: boolean;
  hasRunReport: boolean;
  filtersChangedAfterRun: boolean;
  reportData?: MarksReportData;
  isLoading: boolean;
  onGetReport: () => void;
  onResetFilters: () => void;
  onDownloadPDF: () => void;
  onDownloadExcel: () => void;
  showCycleFilter?: boolean;
  cycleOptions?: SelectOption[];
  showAssessmentFilter?: boolean;
  assessmentOptions?: SelectOption[];
}

export const MarksReportShell = ({
  draftFilters,
  onDraftChange,
  academicTerms,
  programTypes,
  semesters,
  courses,
  sections,
  hasRequiredFilters,
  hasRunReport,
  filtersChangedAfterRun,
  reportData,
  isLoading,
  onGetReport,
  onResetFilters,
  onDownloadPDF,
  onDownloadExcel,
  showCycleFilter = false,
  cycleOptions = [],
  showAssessmentFilter = false,
  assessmentOptions = [],
}: MarksReportShellProps) => {
  const filterFields: FilterFieldConfig<MarksReportFilters>[] = useMemo(
    () => [
      {
        key: "academicTermId",
        label: "Academic Term",
        type: "select",
        allOptionLabel: "All terms",
        placeholder: "Select term...",
        options: academicTerms,
      },
      {
        key: "programType",
        label: "Program Type",
        type: "select",
        allOptionLabel: "All programs",
        placeholder: draftFilters.academicTermId
          ? "All programs"
          : "Select term first",
        options: programTypes,
      },
      {
        key: "semesterId",
        label: "Semester",
        type: "select",
        allOptionLabel: "All semesters",
        placeholder: draftFilters.academicTermId
          ? "Select semester..."
          : "Select term first",
        options: semesters,
      },
      ...(showCycleFilter
        ? [
            {
              key: "cycle",
              label: "Cycle",
              type: "select",
              hideAllOption: true,
              placeholder: "Select cycle...",
              options: cycleOptions,
            } satisfies FilterFieldConfig<MarksReportFilters>,
          ]
        : []),
      {
        key: "courseId",
        label: "Course",
        type: "select",
        allOptionLabel: "All courses",
        placeholder: "Select course...",
        options: courses,
      },
      {
        key: "sectionId",
        label: "Section",
        type: "select",
        hideAllOption: true,
        placeholder: draftFilters.courseId
          ? "Select section..."
          : "Select course first",
        options: sections,
      },
      ...(showAssessmentFilter
        ? [
            {
              key: "assessmentId",
              label: "Assessment",
              type: "select",
              allOptionLabel: "All assessments",
              placeholder: draftFilters.courseId
                ? "All assessments"
                : "Select course first",
              options: assessmentOptions,
            } satisfies FilterFieldConfig<MarksReportFilters>,
          ]
        : []),
    ],
    [
      academicTerms,
      programTypes,
      semesters,
      courses,
      sections,
      draftFilters,
      showCycleFilter,
      cycleOptions,
      showAssessmentFilter,
      assessmentOptions,
    ]
  );

  const getEmptyMessage = () => {
    if (!hasRequiredFilters) {
      return "Select all filters to enable Get Report.";
    }

    if (filtersChangedAfterRun) {
      return "Filters changed. Press Get Report to refresh results.";
    }

    if (!hasRunReport) {
      return "Press Get Report to view marks report.";
    }

    return "No data found for selected filters.";
  };
  return (
    <div className="flex w-full flex-col gap-6">
      <FilterPanel>
        <FilterBuilder
          fields={filterFields}
          draftFilters={draftFilters}
          onDraftChange={onDraftChange}
        />
        <div className="mt-4 flex justify-end">
          <FilterActions
            onApply={onGetReport}
            onReset={onResetFilters}
            isApplyDisabled={!hasRequiredFilters}
            applyLabel="Get Report"
          />
        </div>
      </FilterPanel>
      <main>
        <MarksReportTable
          reportData={reportData}
          isLoading={isLoading}
          onDownloadPDF={onDownloadPDF}
          onDownloadExcel={onDownloadExcel}
          emptyMessage={getEmptyMessage()}
        />
      </main>
    </div>
  );
};
