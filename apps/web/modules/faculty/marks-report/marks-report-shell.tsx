"use client";

import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  DEFAULT_FILTER_ALL_VALUE,
  FilterActions,
  FilterBuilder,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { cn } from "@webcampus/ui/lib/utils";
import { Download, Loader2 } from "lucide-react";
import { useMemo } from "react";
import type { MarksReportData, MarksReportFilters } from "./marks-report-types";

interface SelectOption {
  value: string;
  label: string;
}

interface MarksReportShellProps {
  draftFilters: MarksReportFilters;
  onDraftChange: (key: keyof MarksReportFilters, value: string) => void;
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
        allOptionLabel: "All sections",
        placeholder: draftFilters.courseId
          ? "Select section..."
          : "Select course first",
        options: sections,
      },
    ],
    [academicTerms, programTypes, semesters, courses, sections, draftFilters]
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

  const formatScore = (value: number | null, max: number) => {
    if (value == null) return "-";
    return `${value}/${max}`;
  };

  return (
    <div
      className={cn(
        "flex h-[calc(100dvh-4.5rem)] min-h-0 flex-1 flex-col gap-4 pb-4"
      )}
    >
      <header className="space-y-1 px-1 pt-2">
        <h1 className="text-2xl font-semibold tracking-tight">Marks Report</h1>
        <p className="text-muted-foreground text-sm">
          View consolidated marks report with CIE totals and eligibility status
        </p>
      </header>

      <main className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="rounded-lg border p-4">
          <FilterBuilder
            fields={filterFields}
            draftFilters={draftFilters}
            onDraftChange={onDraftChange}
            allValue={DEFAULT_FILTER_ALL_VALUE}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5"
          />

          <div className="mt-6 flex flex-col items-end justify-between gap-4 md:flex-row md:items-end">
            <FilterActions
              onApply={onGetReport}
              onReset={onResetFilters}
              applyLabel="Get Report"
              resetLabel="Reset"
              isApplyDisabled={!hasRequiredFilters}
              isResetDisabled={!hasRequiredFilters}
            />
          </div>
        </div>

        <div className="space-y-4">
          {reportData && reportData.students.length > 0 ? (
            <>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDownloadExcel}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDownloadPDF}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="bg-background sticky left-0 z-10 min-w-[100px]">
                        USN
                      </TableHead>
                      <TableHead className="bg-background sticky left-[100px] z-10 min-w-[150px]">
                        Student Name
                      </TableHead>
                      {reportData.assessments.map((a) => (
                        <TableHead
                          key={a.id}
                          className="min-w-[100px] whitespace-nowrap text-center"
                        >
                          {a.title}
                          <div className="text-muted-foreground text-xs font-normal">
                            Max: {a.totalMarks}
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="min-w-[100px] text-center">
                        Total CIE
                      </TableHead>
                      <TableHead className="min-w-[100px] text-center">
                        Min Required
                      </TableHead>
                      <TableHead className="min-w-[100px] text-center">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.students.map((student) => {
                      const isEligible = student.status === "ELIGIBLE";
                      return (
                        <TableRow key={student.usn}>
                          <TableCell className="bg-background sticky left-0 z-10 font-mono text-sm">
                            {student.usn}
                          </TableCell>
                          <TableCell className="bg-background sticky left-[100px] z-10 font-medium">
                            {student.name}
                          </TableCell>
                          {reportData.assessments.map((a) => {
                            const score = student.assessments.find(
                              (s) => s.assessmentId === a.id
                            );
                            return (
                              <TableCell
                                key={a.id}
                                className={cn(
                                  "text-center",
                                  score?.totalMarks != null &&
                                    score.totalMarks < a.totalMarks * 0.4
                                    ? "text-rose-600 dark:text-rose-500"
                                    : "text-emerald-600 dark:text-emerald-500"
                                )}
                              >
                                {formatScore(
                                  score?.totalMarks ?? null,
                                  a.totalMarks
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-medium">
                            {student.cieTotal != null ? student.cieTotal : "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            {reportData.course.cumulativeMinMarks}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={isEligible ? "default" : "destructive"}
                              className={cn(
                                isEligible &&
                                  "border-transparent bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                              )}
                            >
                              {isEligible ? "Eligible" : "Not Eligible"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : isLoading ? (
            <div className="text-muted-foreground flex min-h-[200px] items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading report...
            </div>
          ) : (
            <div className="text-muted-foreground flex min-h-[200px] items-center justify-center">
              {getEmptyMessage()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
