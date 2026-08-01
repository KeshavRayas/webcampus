"use client";

import { CondonationReportTable } from "@/components/academics/reports/condonation-tables";
import { useHODDepartment } from "@/modules/hod/department/use-hod-department";
import {
  useHODMarksCourses,
  useHODMarksFilterOptions,
  useHODMarksSections,
} from "@/modules/hod/marks/use-hod-marks-report";
import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useHODCondonationReport } from "./use-condonation";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

type HODCondonationReportFilters = {
  academicTermId: string;
  semesterId: string;
  courseId: string;
  sectionId: string;
  cycle: string;
};

const EMPTY_FILTERS: HODCondonationReportFilters = {
  academicTermId: "",
  semesterId: "",
  courseId: "",
  sectionId: "",
  cycle: "",
};

const hasRequiredFilters = (filters: HODCondonationReportFilters) =>
  Boolean(filters.academicTermId && filters.semesterId && filters.courseId);

const downloadCSV = (filename: string, rows: string[][]) => {
  const csvContent = rows
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const HodCondonationReportView = () => {
  const [draftFilters, setDraftFilters] =
    useState<HODCondonationReportFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<HODCondonationReportFilters>(EMPTY_FILTERS);
  const [hasRunReport, setHasRunReport] = useState(false);
  const [filtersChangedAfterRun, setFiltersChangedAfterRun] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const { data: departmentInfo } = useHODDepartment();
  const isBasicSciences = departmentInfo?.departmentType === "BASIC_SCIENCES";

  const {
    data: optionsData,
    isLoading: termsLoading,
    isError: termsError,
  } = useHODMarksFilterOptions();
  const terms = optionsData?.academicTerms ?? [];

  const semesterOptions = useMemo(() => {
    if (!draftFilters.academicTermId) return [];
    return (optionsData?.semesters ?? []).filter(
      (semester) => semester.academicTermId === draftFilters.academicTermId
    );
  }, [optionsData?.semesters, draftFilters.academicTermId]);
  const selectedDraftSemester = semesterOptions.find(
    (semester) => semester.id === draftFilters.semesterId
  );
  const isSemesterOneOrTwo =
    !!selectedDraftSemester &&
    FIRST_YEAR_UG_SEMESTERS.has(selectedDraftSemester.semesterNumber);

  const { data: courses = [], isLoading: coursesLoading } = useHODMarksCourses(
    draftFilters.semesterId,
    isBasicSciences && isSemesterOneOrTwo ? draftFilters.cycle : ""
  );
  const { data: sections = [], isLoading: sectionsLoading } =
    useHODMarksSections(
      draftFilters.semesterId,
      draftFilters.courseId,
      isBasicSciences && isSemesterOneOrTwo ? draftFilters.cycle : ""
    );

  const hasRequiredDraftFilters = useMemo(
    () => hasRequiredFilters(draftFilters),
    [draftFilters]
  );
  const hasRequiredAppliedFilters = useMemo(
    () => hasRequiredFilters(appliedFilters),
    [appliedFilters]
  );

  const shouldShowReportResults =
    hasRunReport && !filtersChangedAfterRun && hasRequiredAppliedFilters;

  const {
    data: reportData,
    isFetching: isLoadingReport,
    isError: isErrorReport,
    error: errorReport,
  } = useHODCondonationReport(
    shouldShowReportResults
      ? {
          academicTermId: appliedFilters.academicTermId,
          semesterId: appliedFilters.semesterId,
          courseId: appliedFilters.courseId,
          ...(appliedFilters.sectionId
            ? { sectionId: appliedFilters.sectionId }
            : {}),
          ...(isBasicSciences && isSemesterOneOrTwo && appliedFilters.cycle
            ? { cycle: appliedFilters.cycle }
            : {}),
        }
      : null,
    shouldShowReportResults
  );

  useEffect(() => {
    if (!isErrorReport) return;
    toast.error(
      errorReport instanceof Error
        ? errorReport.message
        : "Failed to load condonation report"
    );
  }, [isErrorReport, errorReport]);

  const updateDraftFilter = useCallback(
    (key: keyof HODCondonationReportFilters, value: string) => {
      setDraftFilters((current) => {
        const updated = { ...current, [key]: value };
        if (key === "academicTermId") {
          updated.semesterId = "";
          updated.courseId = "";
          updated.sectionId = "";
          updated.cycle = "";
        } else if (key === "semesterId") {
          updated.courseId = "";
          updated.sectionId = "";
          updated.cycle = "";
        } else if (key === "cycle") {
          updated.courseId = "";
          updated.sectionId = "";
        } else if (key === "courseId") {
          updated.sectionId = "";
        }
        return updated;
      });
      if (hasRunReport) setFiltersChangedAfterRun(true);
    },
    [hasRunReport]
  );

  const onGetReport = useCallback(() => {
    if (!hasRequiredDraftFilters) {
      toast.error("Please select academic term, semester, and course");
      return;
    }
    const nextFilters = {
      ...draftFilters,
      cycle:
        isBasicSciences && isSemesterOneOrTwo
          ? draftFilters.cycle || BASIC_SCIENCES_CYCLE_OPTIONS[0]
          : "",
    };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setHasRunReport(true);
    setFiltersChangedAfterRun(false);
  }, [
    draftFilters,
    hasRequiredDraftFilters,
    isBasicSciences,
    isSemesterOneOrTwo,
  ]);

  const onResetFilters = useCallback(() => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setHasRunReport(false);
    setFiltersChangedAfterRun(false);
    setResetKey((current) => current + 1);
  }, []);

  const getEmptyMessage = useCallback(() => {
    if (!hasRequiredAppliedFilters) {
      return "Select academic term, semester, and course to enable Get Report.";
    }
    if (filtersChangedAfterRun) {
      return "Filters changed. Press Get Report to refresh results.";
    }
    if (!hasRunReport) {
      return "Press Get Report to view condonation report.";
    }
    return "No condonations found for the selected filters.";
  }, [filtersChangedAfterRun, hasRequiredAppliedFilters, hasRunReport]);

  const getHeaderMetadata = useCallback(() => {
    if (!reportData) return [];
    const section =
      sections.find((section) => section.id === appliedFilters.sectionId)
        ?.name || "All Sections";
    return [
      `Department: ${departmentInfo?.departmentName ?? "N/A"}`,
      `Course: ${reportData.course.code} - ${reportData.course.name}`,
      `Semester: ${reportData.semester.semesterNumber}`,
      `Section: ${section}`,
      `Academic Term: ${reportData.semester.academicTerm.type} ${reportData.semester.academicTerm.year}`,
    ];
  }, [
    appliedFilters.sectionId,
    departmentInfo?.departmentName,
    reportData,
    sections,
  ]);

  const handleDownloadPDF = useCallback(() => {
    if (!reportData || !reportData.students.length) return;
    const doc = new jsPDF({ orientation: "landscape" });
    const metadata = getHeaderMetadata();

    doc.setFontSize(16);
    doc.text("Condonation Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

    let yPos = 30;
    metadata.forEach((text) => {
      doc.text(text, 14, yPos);
      yPos += 6;
    });

    const headers = [
      "Sl No.",
      "USN",
      "Student Name",
      "Section",
      "Total Sessions",
      "Present",
      "Condoned",
      "% Before",
      "% After",
      "Status",
    ];

    const rows = reportData.students.map((student, index) => [
      (index + 1).toString(),
      student.usn,
      student.name,
      student.section ?? "-",
      student.totalSessions.toString(),
      student.presentSessions.toString(),
      `+${student.condonedSessions}`,
      `${student.percentageBefore}%`,
      `${student.percentageAfter}%`,
      student.approvalStatus,
    ]);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: yPos + 4,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 30 },
        2: { cellWidth: 40 },
      },
      didParseCell(data) {
        if (
          data.section === "body" &&
          data.column.index === headers.length - 1
        ) {
          data.cell.styles.textColor =
            data.cell.raw === "APPROVED" ? [39, 174, 96] : [192, 57, 43];
          if (data.cell.raw === "APPROVED") data.cell.styles.fontStyle = "bold";
        }
      },
    });

    doc.save("condonation-report.pdf");
  }, [getHeaderMetadata, reportData]);

  const handleDownloadExcel = useCallback(() => {
    if (!reportData || !reportData.students.length) return;
    const metadata = getHeaderMetadata();

    const headers = [
      "Sl No.",
      "USN",
      "Student Name",
      "Section",
      "Total Sessions",
      "Present",
      "Condoned Added",
      "% Before",
      "% After",
      "Status",
    ];

    const rows = reportData.students.map((student, index) => [
      (index + 1).toString(),
      student.usn,
      student.name,
      student.section ?? "-",
      student.totalSessions.toString(),
      student.presentSessions.toString(),
      student.condonedSessions.toString(),
      student.percentageBefore.toString(),
      student.percentageAfter.toString(),
      student.approvalStatus,
    ]);

    downloadCSV("condonation-report.csv", [
      ["Condonation Report"],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      ...metadata.map((item) => [item]),
      [],
      headers,
      ...rows,
    ]);
  }, [getHeaderMetadata, reportData]);

  const filterFields = useMemo<
    FilterFieldConfig<HODCondonationReportFilters>[]
  >(
    () => [
      {
        key: "academicTermId",
        label: "Academic Term",
        type: "select",
        hideAllOption: true,
        options: terms.map((term) => ({
          label: `${term.type.charAt(0).toUpperCase() + term.type.slice(1)} ${term.year}`,
          value: term.id,
        })),
      },
      {
        key: "semesterId",
        label: "Semester",
        type: "select",
        hideAllOption: true,
        placeholder: draftFilters.academicTermId
          ? "Select semester"
          : "Select term first",
        options: semesterOptions.map((semester) => ({
          label: `${semester.programType} - Semester ${semester.semesterNumber}`,
          value: semester.id,
        })),
      },
      ...(isBasicSciences && isSemesterOneOrTwo
        ? [
            {
              key: "cycle" as const,
              label: "Cycle",
              type: "select" as const,
              hideAllOption: true,
              options: BASIC_SCIENCES_CYCLE_OPTIONS.map((cycle) => ({
                label: cycle,
                value: cycle,
              })),
            },
          ]
        : []),
      {
        key: "courseId",
        label: "Course",
        type: "select",
        hideAllOption: true,
        placeholder: coursesLoading
          ? "Loading courses..."
          : draftFilters.semesterId
            ? "Select course"
            : "Select semester first",
        options: courses.map((course) => ({
          label: `${course.code} - ${course.name}`,
          value: course.id,
        })),
      },
      {
        key: "sectionId",
        label: "Section",
        type: "select",
        hideAllOption: false,
        placeholder: sectionsLoading
          ? "Loading sections..."
          : draftFilters.courseId
            ? "All sections"
            : "Select course first",
        options: sections.map((section) => ({
          label: section.name,
          value: section.id,
        })),
      },
    ],
    [
      courses,
      coursesLoading,
      draftFilters.academicTermId,
      draftFilters.courseId,
      draftFilters.semesterId,
      isBasicSciences,
      isSemesterOneOrTwo,
      sections,
      sectionsLoading,
      semesterOptions,
      terms,
    ]
  );

  if (termsLoading) {
    return (
      <div className="text-muted-foreground flex min-h-[200px] items-center justify-center text-sm">
        Loading academic terms...
      </div>
    );
  }

  if (termsError) {
    return (
      <div className="text-destructive flex min-h-[200px] items-center justify-center text-sm">
        Failed to load academic terms. Please try again later.
      </div>
    );
  }

  if (terms.length === 0) {
    return (
      <div className="text-muted-foreground flex min-h-[200px] items-center justify-center text-sm">
        No academic terms available.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">
          Condonation Report
        </h3>
        <p className="text-muted-foreground text-sm">
          View students granted condonation and their before/after attendance
          metrics.
        </p>
      </div>

      <FilterPanel key={resetKey}>
        <FilterBuilder
          fields={filterFields}
          draftFilters={draftFilters}
          onDraftChange={updateDraftFilter}
          className="md:grid-cols-2 xl:grid-cols-5"
        />
        <div className="mt-4 flex justify-end">
          <FilterActions
            onApply={onGetReport}
            onReset={onResetFilters}
            isApplyDisabled={!hasRequiredDraftFilters}
            applyLabel="Get Report"
          />
        </div>
      </FilterPanel>

      {shouldShowReportResults ? (
        <div className="bg-card text-card-foreground rounded-xl border p-4 shadow-sm">
          <CondonationReportTable
            reportData={reportData}
            isLoading={isLoadingReport}
            onDownloadPDF={handleDownloadPDF}
            onDownloadExcel={handleDownloadExcel}
            emptyMessage={getEmptyMessage()}
          />
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          {getEmptyMessage()}
        </div>
      )}
    </div>
  );
};
