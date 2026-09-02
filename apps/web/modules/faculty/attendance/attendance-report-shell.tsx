"use client";

import {
  AttendanceDetailedTable,
  AttendancePercentageTable,
  AttendanceStatusTable,
} from "@/components/academics/reports/attendance-tables";
import { Button } from "@webcampus/ui/components/button";
import {
  DEFAULT_FILTER_ALL_VALUE,
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import { cn } from "@webcampus/ui/lib/utils";
import { useMemo } from "react";
import type { DetailedReportData } from "./attendance-report-types";

type AcademicTermOption = {
  id: string;
  year: string;
  type: "odd" | "even" | "supplementary";
};

type SemesterOption = {
  id: string;
  academicTermId: string;
  programType: "UG" | "PG";
  semesterNumber: number;
};

type CourseOption = {
  id: string;
  code: string;
  name: string;
};

type SectionOption = {
  id: string;
  name: string;
  courseId: string;
  assignmentType?: "THEORY" | "LAB";
  batchId?: string;
  labBatchNumber?: number;
  label?: string;
};

type SessionWithCounts = {
  id: string;
  sessionDate: string;
  courseCode: string;
  courseName: string;
  sectionName: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  percentage: number;
};

type AttendanceReportFilters = {
  academicTermId: string;
  programType: string;
  semesterId: string;
  courseId: string;
  sectionId: string;
  cycle?: string;
};

type AttendanceReportShellProps = {
  activeTab: "status" | "detailed" | "percentage";
  onTabChange: (tab: "status" | "detailed" | "percentage") => void;
  draftFilters: AttendanceReportFilters;
  onDraftChange: (key: string, value: string) => void;
  academicTerms: AcademicTermOption[];
  semesters: SemesterOption[];
  courses: CourseOption[];
  sections: SectionOption[];
  hasRequiredFilters: boolean;
  hasRunReport: boolean;
  filtersChangedAfterRun: boolean;
  statusReportData: SessionWithCounts[];
  isErrorSessions: boolean;
  errorSessions: unknown;
  onGetReport: () => void;
  onResetFilters: () => void;
  onSessionSelect: (sessionId: string) => void;
  detailedReportData?: DetailedReportData;
  isLoadingDetailed?: boolean;
  onDownloadDetailedPDF?: () => void;
  onDownloadDetailedExcel?: () => void; // New Prop
  percentageReportData?: DetailedReportData;
  percentageFrom?: string;
  percentageTo?: string;
  onPercentageFilterChange?: (
    key: "percentageFrom" | "percentageTo",
    value: string
  ) => void;
  onDownloadPercentagePDF?: () => void;
  onDownloadPercentageExcel?: () => void; // New Prop
  showCycleFilter?: boolean;
  cycleOptions?: Array<{ label: string; value: string }>;
  sectionFilterLabel?: string;
};

export const AttendanceReportShell = ({
  activeTab,
  onTabChange,
  draftFilters,
  onDraftChange,
  academicTerms,
  semesters,
  courses,
  sections,
  hasRequiredFilters,
  hasRunReport,
  filtersChangedAfterRun,
  statusReportData,
  isErrorSessions,
  errorSessions,
  onGetReport,
  onResetFilters,
  onSessionSelect,
  detailedReportData,
  isLoadingDetailed,
  onDownloadDetailedPDF,
  onDownloadDetailedExcel,
  percentageReportData,
  percentageFrom,
  percentageTo,
  onPercentageFilterChange,
  onDownloadPercentagePDF,
  onDownloadPercentageExcel,
  showCycleFilter = false,
  cycleOptions = [],
  sectionFilterLabel = "Section",
}: AttendanceReportShellProps) => {
  const getStatusEmptyMessage = () => {
    if (!hasRequiredFilters) {
      return "Select all filters to enable Get Report.";
    }

    if (filtersChangedAfterRun) {
      return "Filters changed. Press Get Report to refresh results.";
    }

    if (!hasRunReport) {
      return "Press Get Report to view attendance sessions.";
    }

    return "No sessions found for selected filters.";
  };

  const getDetailedEmptyMessage = () => {
    if (!hasRequiredFilters) {
      return "Select all filters to enable Get Report.";
    }

    if (filtersChangedAfterRun) {
      return "Filters changed. Press Get Report to refresh detailed report.";
    }

    if (!hasRunReport) {
      return "Press Get Report to view detailed report.";
    }

    return "No student data found for selected filters.";
  };

  const getPercentageEmptyMessage = () => {
    if (!hasRequiredFilters) {
      return "Select all filters to enable Get Report.";
    }

    if (filtersChangedAfterRun) {
      return "Filters changed. Press Get Report to refresh percentage report.";
    }

    if (!hasRunReport) {
      return "Press Get Report to view percentage report.";
    }

    return "No student data found for selected filters.";
  };

  const filterFields: FilterFieldConfig<AttendanceReportFilters>[] =
    useMemo(() => {
      const uniqueCourses = courses.filter(
        (course, index, self) =>
          index === self.findIndex((c) => c.id === course.id)
      );
      const uniqueSections = sections.filter(
        (section, index, self) =>
          index === self.findIndex((s) => s.id === section.id)
      );

      return [
        {
          key: "academicTermId",
          label: "Academic Term",
          type: "select",
          allOptionLabel: "All terms",
          placeholder: "Select term...",
          options: academicTerms.map((term) => ({
            label: `${term.type.toUpperCase()} ${term.year}`,
            value: term.id,
          })),
        },
        {
          key: "programType",
          label: "Program Type",
          type: "select",
          allOptionLabel: "All programs",
          placeholder: draftFilters.academicTermId
            ? "All programs"
            : "Select term first",
          options: [
            { label: "UG", value: "UG" },
            { label: "PG", value: "PG" },
          ],
        },
        {
          key: "semesterId",
          label: "Semester",
          type: "select",
          allOptionLabel: "All semesters",
          placeholder: draftFilters.academicTermId
            ? "Select semester..."
            : "Select term first",
          options: semesters.map((sem) => ({
            label: `Semester ${sem.semesterNumber} (${sem.programType})`,
            value: sem.id,
          })),
        },
        ...(showCycleFilter
          ? [
              {
                key: "cycle" as const,
                label: "Cycle",
                type: "select" as const,
                hideAllOption: true,
                placeholder: "Select cycle...",
                options: cycleOptions,
              } satisfies FilterFieldConfig<AttendanceReportFilters>,
            ]
          : []),
        {
          key: "courseId",
          label: "Course",
          type: "select",
          allOptionLabel: "All courses",
          placeholder: "Select course...",
          options: uniqueCourses.map((course) => ({
            label: `${course.code} - ${course.name}`,
            value: course.id,
          })),
        },
        {
          key: "sectionId",
          label: sectionFilterLabel,
          type: "select",
          allOptionLabel: `All ${sectionFilterLabel.toLowerCase()}s`,
          placeholder: draftFilters.courseId
            ? `Select ${sectionFilterLabel.toLowerCase()}...`
            : "Select course first",
          options: uniqueSections.map((section) => ({
            label: section.label || section.name,
            value: section.id,
          })),
        },
      ];
    }, [
      academicTerms,
      semesters,
      courses,
      sections,
      draftFilters,
      showCycleFilter,
      cycleOptions,
      sectionFilterLabel,
    ]);

  return (
    <div
      className={cn(
        "flex h-[calc(100dvh-4.5rem)] min-h-0 flex-1 flex-col gap-4 pb-4"
      )}
    >
      <header className="space-y-1 px-1 pt-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Attendance Report
        </h1>
        <p className="text-muted-foreground text-sm">
          View attendance statistics and reports
        </p>
      </header>

      <div className="flex gap-2 px-1">
        <Button
          variant={activeTab === "status" ? "default" : "ghost"}
          size="default"
          onClick={() => onTabChange("status")}
        >
          Status Report
        </Button>
        <Button
          variant={activeTab === "detailed" ? "default" : "ghost"}
          size="default"
          onClick={() => onTabChange("detailed")}
        >
          Detailed Report
        </Button>
        <Button
          variant={activeTab === "percentage" ? "default" : "ghost"}
          size="default"
          onClick={() => onTabChange("percentage")}
        >
          Percentage Report
        </Button>
      </div>

      <main className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <FilterPanel>
          <FilterBuilder
            fields={filterFields}
            draftFilters={draftFilters}
            onDraftChange={onDraftChange}
            allValue={DEFAULT_FILTER_ALL_VALUE}
          />

          {/* Action Row - Includes Percentage Filters inline if active */}
          <div className="mt-6 flex flex-col items-end justify-between gap-4 md:flex-row md:items-end">
            <div className="w-full md:w-auto">
              {activeTab === "percentage" && (
                <div className="md:w-75 grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="percentageFrom">Percentage From (%)</Label>
                    <Input
                      id="percentageFrom"
                      type="number"
                      min={0}
                      max={100}
                      placeholder="0"
                      value={percentageFrom ?? ""}
                      onChange={(e) =>
                        onPercentageFilterChange?.(
                          "percentageFrom",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="percentageTo">Percentage To (%)</Label>
                    <Input
                      id="percentageTo"
                      type="number"
                      min={0}
                      max={100}
                      placeholder="100"
                      value={percentageTo ?? ""}
                      onChange={(e) =>
                        onPercentageFilterChange?.(
                          "percentageTo",
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            <FilterActions
              onApply={onGetReport}
              onReset={onResetFilters}
              applyLabel="Get Report"
              resetLabel="Reset"
              isApplyDisabled={!hasRequiredFilters}
              isResetDisabled={!hasRequiredFilters}
            />
          </div>
        </FilterPanel>

        {activeTab === "status" && (
          <AttendanceStatusTable
            statusReportData={statusReportData}
            isErrorSessions={isErrorSessions}
            errorSessions={errorSessions}
            onSessionSelect={onSessionSelect}
            emptyMessage={getStatusEmptyMessage()}
          />
        )}

        {activeTab === "detailed" && (
          <AttendanceDetailedTable
            detailedReportData={detailedReportData}
            isLoadingDetailed={isLoadingDetailed}
            onDownloadDetailedPDF={onDownloadDetailedPDF}
            onDownloadDetailedExcel={onDownloadDetailedExcel}
            emptyMessage={getDetailedEmptyMessage()}
          />
        )}

        {activeTab === "percentage" && (
          <AttendancePercentageTable
            percentageReportData={percentageReportData}
            onDownloadPercentagePDF={onDownloadPercentagePDF}
            onDownloadPercentageExcel={onDownloadPercentageExcel}
            emptyMessage={getPercentageEmptyMessage()}
          />
        )}
      </main>
    </div>
  );
};
