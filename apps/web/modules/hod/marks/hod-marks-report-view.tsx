"use client";

import { MarksReportShell } from "@/modules/faculty/marks-report/marks-report-shell";
import type { MarksReportFilters } from "@/modules/faculty/marks-report/marks-report-types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  useHODMarksAssessments,
  useHODMarksCourses,
  useHODMarksFilterOptions,
  useHODMarksReportData,
  useHODMarksSections,
} from "./use-hod-marks-report";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;
const ALL_ASSESSMENTS_VALUE = "__all__";

type HODMarksReportFilters = MarksReportFilters & {
  cycle: string;
  assessmentId: string;
};

const EMPTY_FILTERS: HODMarksReportFilters = {
  academicTermId: "",
  programType: "",
  semesterId: "",
  courseId: "",
  sectionId: "",
  cycle: "",
  assessmentId: ALL_ASSESSMENTS_VALUE,
};

const hasRequiredFilters = (filters: HODMarksReportFilters) =>
  Boolean(
    filters.academicTermId &&
      filters.programType &&
      filters.semesterId &&
      filters.courseId &&
      filters.sectionId
  );

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

export const HodMarksReportView = () => {
  const [draftFilters, setDraftFilters] =
    useState<HODMarksReportFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<HODMarksReportFilters>(EMPTY_FILTERS);
  const [hasRunReport, setHasRunReport] = useState(false);
  const [filtersChangedAfterRun, setFiltersChangedAfterRun] = useState(false);

  const { data: optionsData } = useHODMarksFilterOptions();
  const isBasicSciences = optionsData?.departmentType === "BASIC_SCIENCES";

  const semestersForTerm = useMemo(() => {
    if (!draftFilters.academicTermId) return [];
    return (optionsData?.semesters ?? []).filter(
      (semester) => semester.academicTermId === draftFilters.academicTermId
    );
  }, [optionsData?.semesters, draftFilters.academicTermId]);

  const filteredSemesters = useMemo(() => {
    if (!draftFilters.programType) return semestersForTerm;
    return semestersForTerm.filter(
      (semester) => semester.programType === draftFilters.programType
    );
  }, [draftFilters.programType, semestersForTerm]);

  const selectedDraftSemester = filteredSemesters.find(
    (semester) => semester.id === draftFilters.semesterId
  );
  const isSemesterOneOrTwo =
    !!selectedDraftSemester &&
    FIRST_YEAR_UG_SEMESTERS.has(selectedDraftSemester.semesterNumber);

  const { data: courses = [] } = useHODMarksCourses(
    draftFilters.semesterId,
    isBasicSciences && isSemesterOneOrTwo ? draftFilters.cycle : ""
  );
  const { data: sections = [] } = useHODMarksSections(
    draftFilters.semesterId,
    draftFilters.courseId,
    isBasicSciences && isSemesterOneOrTwo ? draftFilters.cycle : ""
  );
  const { data: assessments = [] } = useHODMarksAssessments(
    draftFilters.courseId
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
  } = useHODMarksReportData(
    shouldShowReportResults
      ? {
          courseId: appliedFilters.courseId,
          sectionId: appliedFilters.sectionId,
          assessmentId:
            appliedFilters.assessmentId &&
            appliedFilters.assessmentId !== ALL_ASSESSMENTS_VALUE
              ? appliedFilters.assessmentId
              : undefined,
        }
      : null,
    shouldShowReportResults
  );

  useEffect(() => {
    if (!isErrorReport) return;
    toast.error(
      errorReport instanceof Error
        ? errorReport.message
        : "Failed to load marks report"
    );
  }, [isErrorReport, errorReport]);

  const academicTerms = useMemo(
    () =>
      (optionsData?.academicTerms ?? []).map((term) => ({
        value: term.id,
        label: `${term.type.charAt(0).toUpperCase() + term.type.slice(1)} ${term.year}`,
      })),
    [optionsData?.academicTerms]
  );

  const semesterOptions = useMemo(
    () =>
      filteredSemesters.map((semester) => ({
        value: semester.id,
        label: `Semester ${semester.semesterNumber} (${semester.programType})`,
      })),
    [filteredSemesters]
  );

  const courseOptions = useMemo(
    () =>
      courses.map((course) => ({
        value: course.id,
        label: `${course.code} - ${course.name}`,
      })),
    [courses]
  );

  const sectionOptions = useMemo(
    () =>
      sections.map((section) => ({
        value: section.id,
        label: section.name,
      })),
    [sections]
  );

  const updateDraftFilter = useCallback(
    (key: string, value: string) => {
      setDraftFilters((current) => {
        const updated: HODMarksReportFilters = { ...current, [key]: value };
        if (key === "academicTermId") {
          updated.programType = "";
          updated.semesterId = "";
          updated.courseId = "";
          updated.sectionId = "";
          updated.cycle = "";
          updated.assessmentId = ALL_ASSESSMENTS_VALUE;
        } else if (key === "programType") {
          updated.semesterId = "";
          updated.courseId = "";
          updated.sectionId = "";
          updated.cycle = "";
          updated.assessmentId = ALL_ASSESSMENTS_VALUE;
        } else if (key === "semesterId") {
          updated.courseId = "";
          updated.sectionId = "";
          updated.cycle = "";
          updated.assessmentId = ALL_ASSESSMENTS_VALUE;
        } else if (key === "cycle") {
          updated.courseId = "";
          updated.sectionId = "";
          updated.assessmentId = ALL_ASSESSMENTS_VALUE;
        } else if (key === "courseId") {
          updated.sectionId = "";
          updated.assessmentId = ALL_ASSESSMENTS_VALUE;
        }
        return updated;
      });

      if (hasRunReport) setFiltersChangedAfterRun(true);
    },
    [hasRunReport]
  );

  const onGetReport = useCallback(() => {
    if (!hasRequiredDraftFilters) {
      toast.error("Please select all filters");
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
  }, []);

  const getHeaderMetadata = useCallback(() => {
    if (!reportData) return [];
    return [
      `Course: ${reportData.course.code} - ${reportData.course.name}`,
      `Semester: ${reportData.semester.semesterNumber}`,
      `Academic Term: ${reportData.semester.academicTerm.type} ${reportData.semester.academicTerm.year}`,
      `Min Required CIE: ${reportData.course.cumulativeMinMarks}`,
    ];
  }, [reportData]);

  const handleDownloadPDF = useCallback(() => {
    if (!reportData || !reportData.students.length) return;
    const doc = new jsPDF({ orientation: "landscape" });
    const metadata = getHeaderMetadata();

    doc.setFontSize(16);
    doc.text("Marks Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

    let yPos = 30;
    metadata.forEach((text) => {
      doc.text(text, 14, yPos);
      yPos += 6;
    });

    const assessmentHeaders = reportData.assessments.map(
      (assessment) => assessment.title
    );
    const headers = [
      "USN",
      "Student Name",
      ...assessmentHeaders,
      "Total CIE",
      "Min Required",
      "Status",
    ];

    const rows = reportData.students.map((student) => [
      student.usn,
      student.name,
      ...reportData.assessments.map((assessment) => {
        const score = student.assessments.find(
          (entry) => entry.assessmentId === assessment.id
        );
        return score?.totalMarks != null
          ? `${score.totalMarks}/${assessment.totalMarks}`
          : "-";
      }),
      student.cieTotal != null ? student.cieTotal.toString() : "-",
      reportData.course.cumulativeMinMarks.toString(),
      student.status === "ELIGIBLE" ? "Eligible" : "Not Eligible",
    ]);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: yPos + 4,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 35 } },
      didParseCell(data) {
        if (
          data.section === "body" &&
          data.column.index === headers.length - 1
        ) {
          data.cell.styles.textColor =
            data.cell.raw === "Eligible" ? [39, 174, 96] : [192, 57, 43];
          if (data.cell.raw === "Eligible") data.cell.styles.fontStyle = "bold";
        }
      },
    });

    doc.save("marks-report.pdf");
  }, [reportData, getHeaderMetadata]);

  const handleDownloadExcel = useCallback(() => {
    if (!reportData || !reportData.students.length) return;
    const metadata = getHeaderMetadata();

    const assessmentHeaders = reportData.assessments.map(
      (assessment) => `${assessment.title} (/${assessment.totalMarks})`
    );
    const headers = [
      "USN",
      "Student Name",
      ...assessmentHeaders,
      "Total CIE",
      "Min Required",
      "Status",
    ];

    const rows = reportData.students.map((student) => [
      student.usn,
      student.name,
      ...reportData.assessments.map((assessment) => {
        const score = student.assessments.find(
          (entry) => entry.assessmentId === assessment.id
        );
        return score?.totalMarks != null ? score.totalMarks.toString() : "-";
      }),
      student.cieTotal != null ? student.cieTotal.toString() : "-",
      reportData.course.cumulativeMinMarks.toString(),
      student.status === "ELIGIBLE" ? "Eligible" : "Not Eligible",
    ]);

    downloadCSV("marks-report.csv", [
      ["Marks Report"],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      ...metadata.map((item) => [item]),
      [],
      headers,
      ...rows,
    ]);
  }, [reportData, getHeaderMetadata]);

  const cycleOptions = useMemo(
    () =>
      BASIC_SCIENCES_CYCLE_OPTIONS.map((cycle) => ({
        value: cycle,
        label: cycle,
      })),
    []
  );

  const assessmentOptions = useMemo(
    () =>
      assessments.map((assessment) => ({
        value: assessment.id,
        label: assessment.title,
      })),
    [assessments]
  );

  return (
    <MarksReportShell
      draftFilters={draftFilters}
      onDraftChange={updateDraftFilter}
      academicTerms={academicTerms}
      programTypes={[
        { value: "UG", label: "UG" },
        { value: "PG", label: "PG" },
      ]}
      semesters={semesterOptions}
      courses={courseOptions}
      sections={sectionOptions}
      hasRequiredFilters={hasRequiredDraftFilters}
      hasRunReport={hasRunReport}
      filtersChangedAfterRun={filtersChangedAfterRun}
      reportData={reportData}
      isLoading={isLoadingReport}
      onGetReport={onGetReport}
      onResetFilters={onResetFilters}
      onDownloadPDF={handleDownloadPDF}
      onDownloadExcel={handleDownloadExcel}
      showCycleFilter={isBasicSciences && isSemesterOneOrTwo}
      cycleOptions={cycleOptions}
      showAssessmentFilter={assessments.length > 0}
      assessmentOptions={assessmentOptions}
    />
  );
};
