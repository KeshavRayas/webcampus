"use client";

import { dayjs } from "@webcampus/common/dayjs";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  DEFAULT_FILTER_ALL_VALUE,
  FilterActions,
  FilterBuilder,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
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
import type { DetailedReportData } from "./attendance-report-types";

type AcademicTermOption = {
  id: string;
  year: string;
  type: "odd" | "even";
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
};

type AttendanceReportShellProps = {
  activeTab: "status" | "detailed" | "percentage";
  onTabChange: (tab: "status" | "detailed" | "percentage") => void;
  draftFilters: AttendanceReportFilters;
  onDraftChange: (key: keyof AttendanceReportFilters, value: string) => void;
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
            label: `${term.type.charAt(0).toUpperCase() + term.type.slice(1)} ${term.year}`,
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
          label: "Section",
          type: "select",
          allOptionLabel: "All sections",
          placeholder: draftFilters.courseId
            ? "Select section..."
            : "Select course first",
          options: uniqueSections.map((section) => ({
            label: section.label || section.name,
            value: section.id,
          })),
        },
      ];
    }, [academicTerms, semesters, courses, sections, draftFilters]);

  const getEligibilityStatus = (
    percentage: number,
    condonationStatus: string
  ): "Eligible" | "Not Eligible" => {
    if (percentage >= 85) return "Eligible";
    if (percentage >= 75 && condonationStatus === "APPROVED") return "Eligible";
    return "Not Eligible";
  };

  const formatCondonationStatus = (status: string): string => {
    switch (status) {
      case "NOT_REQUESTED":
        return "Not Requested";
      case "PENDING":
        return "Pending";
      case "APPROVED":
        return "Approved";
      case "REJECTED":
        return "Rejected";
      default:
        return status;
    }
  };

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
        <div className="rounded-lg border p-4">
          <FilterBuilder
            fields={filterFields}
            draftFilters={draftFilters}
            onDraftChange={onDraftChange}
            allValue={DEFAULT_FILTER_ALL_VALUE}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5"
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
        </div>

        {activeTab === "status" && (
          <>
            {isErrorSessions && (
              <div className="text-destructive border-destructive/20 bg-destructive/5 rounded-lg border p-4 text-sm">
                {errorSessions instanceof Error
                  ? errorSessions.message
                  : "Failed to load attendance sessions"}
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date of Session</TableHead>
                  <TableHead>Total Students</TableHead>
                  <TableHead>Present Students</TableHead>
                  <TableHead>Absent Students</TableHead>
                  <TableHead>Class % PER.</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statusReportData.length > 0 ? (
                  statusReportData.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        {session.sessionDate
                          ? dayjs(session.sessionDate).format("MMM D, YYYY")
                          : "-"}
                      </TableCell>
                      <TableCell>{session.totalStudents}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-green-500">
                          {session.presentCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">
                          {session.absentCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {session.percentage}%
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSessionSelect(session.id)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground h-24 text-center"
                    >
                      {getStatusEmptyMessage()}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}

        {activeTab === "detailed" && (
          <div className="space-y-4">
            {detailedReportData && detailedReportData.students.length > 0 ? (
              <>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDownloadDetailedExcel}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDownloadDetailedPDF}
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
                        <TableHead className="bg-background min-w-25 sticky left-0 z-10">
                          USN
                        </TableHead>
                        <TableHead className="bg-background left-25 min-w-37.5 sticky z-10">
                          Student Name
                        </TableHead>
                        {detailedReportData.sessions.map((session) => (
                          <TableHead
                            key={session.id}
                            className="min-w-20 whitespace-nowrap text-center"
                          >
                            {dayjs(session.sessionDate).format("MMM D")}
                          </TableHead>
                        ))}
                        <TableHead className="min-w-20 text-center">
                          Total Session
                        </TableHead>
                        <TableHead className="min-w-25 text-center">
                          Condonation
                        </TableHead>
                        <TableHead className="min-w-20 text-center">
                          Present
                        </TableHead>
                        <TableHead className="min-w-20 text-center">
                          Absent
                        </TableHead>
                        <TableHead className="min-w-20 text-center">
                          Percentage %
                        </TableHead>
                        <TableHead className="min-w-25 text-center">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailedReportData.students.map((student) => {
                        const status = getEligibilityStatus(
                          student.percentage,
                          student.condonationStatus
                        );
                        return (
                          <TableRow key={student.studentId}>
                            <TableCell className="bg-background sticky left-0 z-10 font-mono text-sm">
                              {student.usn}
                            </TableCell>
                            <TableCell className="bg-background left-25 sticky z-10 font-medium">
                              {student.name}
                            </TableCell>
                            {student.sessionStatuses.map(
                              (sessionStatus, idx) => (
                                <TableCell
                                  key={idx}
                                  className={cn(
                                    "text-center font-medium",
                                    sessionStatus === "PRESENT"
                                      ? "text-emerald-600 dark:text-emerald-500"
                                      : "text-rose-600 dark:text-rose-500"
                                  )}
                                >
                                  {sessionStatus === "PRESENT" ? "P" : "A"}
                                </TableCell>
                              )
                            )}
                            <TableCell className="text-center font-medium">
                              {student.totalSessions}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={
                                  student.condonationStatus === "APPROVED"
                                    ? "default"
                                    : student.condonationStatus === "PENDING"
                                      ? "outline"
                                      : student.condonationStatus === "REJECTED"
                                        ? "destructive"
                                        : "secondary"
                                }
                                className="text-xs"
                              >
                                {formatCondonationStatus(
                                  student.condonationStatus
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-500">
                              {student.presentSessions}
                            </TableCell>
                            <TableCell className="text-center font-medium text-rose-600 dark:text-rose-500">
                              {student.absentSessions}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {student.percentage}%
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={
                                  status === "Eligible"
                                    ? "default"
                                    : "destructive"
                                }
                                className={cn(
                                  status === "Eligible" &&
                                    "border-transparent bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                                )}
                              >
                                {status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : isLoadingDetailed ? (
              <div className="text-muted-foreground min-h-50 flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading detailed report...
              </div>
            ) : (
              <div className="text-muted-foreground min-h-50 flex items-center justify-center">
                {getDetailedEmptyMessage()}
              </div>
            )}
          </div>
        )}

        {activeTab === "percentage" && (
          <div className="space-y-4">
            {percentageReportData &&
            percentageReportData.students.length > 0 ? (
              <>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDownloadPercentageExcel}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDownloadPercentagePDF}
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
                        <TableHead className="bg-background min-w-25 sticky left-0 z-10">
                          USN
                        </TableHead>
                        <TableHead className="bg-background left-25 min-w-37.5 sticky z-10">
                          Student Name
                        </TableHead>
                        <TableHead className="min-w-25 text-center">
                          Total Sessions
                        </TableHead>
                        <TableHead className="min-w-30 text-center">
                          Condonation
                        </TableHead>
                        <TableHead className="min-w-25 text-center">
                          Present Sessions
                        </TableHead>
                        <TableHead className="min-w-25 text-center">
                          Absent Sessions
                        </TableHead>
                        <TableHead className="min-w-25 text-center">
                          % Percentage
                        </TableHead>
                        <TableHead className="min-w-25 text-center">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {percentageReportData.students.map((student) => {
                        const status = getEligibilityStatus(
                          student.percentage,
                          student.condonationStatus
                        );
                        const condonationLabel =
                          student.condonationStatus === "APPROVED"
                            ? "Condoned"
                            : "Not Condoned";
                        return (
                          <TableRow key={student.studentId}>
                            <TableCell className="bg-background sticky left-0 z-10 font-mono text-sm">
                              {student.usn}
                            </TableCell>
                            <TableCell className="bg-background left-25 sticky z-10 font-medium">
                              {student.name}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {student.totalSessions}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={
                                  student.condonationStatus === "APPROVED"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {condonationLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-500">
                              {student.presentSessions}
                            </TableCell>
                            <TableCell className="text-center font-medium text-rose-600 dark:text-rose-500">
                              {student.absentSessions}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {student.percentage}%
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={
                                  status === "Eligible"
                                    ? "default"
                                    : "destructive"
                                }
                                className={cn(
                                  status === "Eligible" &&
                                    "border-transparent bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                                )}
                              >
                                {status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : !percentageReportData ||
              percentageReportData.students.length === 0 ? (
              <div className="text-muted-foreground min-h-50 flex items-center justify-center">
                {getPercentageEmptyMessage()}
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
};
