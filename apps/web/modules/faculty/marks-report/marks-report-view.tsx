"use client";

import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useFacultyHandlingFilterOptions } from "../handling/use-faculty-handling";
import {
  getMarksReport,
  getMarksReportFilterOptions,
} from "./marks-report-api";
import { MarksReportShell } from "./marks-report-shell";
import type { MarksReportFilters } from "./marks-report-types";

const EMPTY_FILTERS: MarksReportFilters = {
  academicTermId: "",
  programType: "",
  semesterId: "",
  courseId: "",
  sectionId: "",
};

const hasRequiredFilters = (filters: MarksReportFilters) =>
  Boolean(
    filters.academicTermId &&
      filters.programType &&
      filters.semesterId &&
      filters.courseId &&
      filters.sectionId
  );

const downloadCSV = (filename: string, rows: string[][]) => {
  const csvContent = rows
    .map((e) => e.map((cell) => `"${cell}"`).join(","))
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

export const MarksReportView = () => {
  const [draftFilters, setDraftFilters] =
    useState<MarksReportFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<MarksReportFilters>(EMPTY_FILTERS);
  const [hasRunReport, setHasRunReport] = useState(false);
  const [filtersChangedAfterRun, setFiltersChangedAfterRun] = useState(false);
  const [runToken, setRunToken] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const { data: handlingOptions } = useFacultyHandlingFilterOptions("courses");
  const { data: filterOptions } = useQuery({
    queryKey: ["marks-report-filter-options"],
    queryFn: getMarksReportFilterOptions,
    staleTime: 5 * 60 * 1000,
  });

  const { data: reportData, isFetching: isLoadingReport } = useQuery({
    queryKey: [
      "marks-report",
      appliedFilters.courseId,
      appliedFilters.sectionId,
      runToken,
    ],
    queryFn: () =>
      getMarksReport(
        appliedFilters.courseId,
        appliedFilters.sectionId || undefined
      ),
    enabled:
      hasRunReport &&
      !filtersChangedAfterRun &&
      hasRequiredFilters(appliedFilters),
    staleTime: 0,
  });

  const academicTerms = useMemo(() => {
    return (handlingOptions?.academicTerms ?? []).map((t) => ({
      value: t.id,
      label: `${t.type.charAt(0).toUpperCase() + t.type.slice(1)} ${t.year}`,
    }));
  }, [handlingOptions]);

  const semestersForTerm = useMemo(() => {
    const allSemesters = handlingOptions?.semesters ?? [];
    if (!draftFilters.academicTermId) return [];
    return allSemesters.filter(
      (sem) => sem.academicTermId === draftFilters.academicTermId
    );
  }, [handlingOptions?.semesters, draftFilters.academicTermId]);

  const filteredSemesters = useMemo(() => {
    if (!draftFilters.programType) return semestersForTerm;
    return semestersForTerm.filter(
      (sem) => sem.programType === draftFilters.programType
    );
  }, [semestersForTerm, draftFilters.programType]);

  const semesterOptions = useMemo(() => {
    return filteredSemesters.map((s) => ({
      value: s.id,
      label: `Semester ${s.semesterNumber} (${s.programType})`,
    }));
  }, [filteredSemesters]);

  const courseOptions = useMemo(() => {
    if (!draftFilters.semesterId) return [];
    const unique = new Map<string, { value: string; label: string }>();
    (filterOptions?.courses ?? [])
      .filter((c) => c.semesterId === draftFilters.semesterId)
      .forEach((c) => {
        if (!unique.has(c.id)) {
          unique.set(c.id, { value: c.id, label: `${c.code} - ${c.name}` });
        }
      });
    return Array.from(unique.values());
  }, [filterOptions, draftFilters.semesterId]);

  const sectionOptions = useMemo(() => {
    if (!draftFilters.courseId) return [];
    const unique = new Map<string, { value: string; label: string }>();
    (filterOptions?.courses ?? [])
      .filter((c) => c.id === draftFilters.courseId)
      .forEach((c) => {
        if (!unique.has(c.sectionId)) {
          unique.set(c.sectionId, { value: c.sectionId, label: c.sectionName });
        }
      });
    return Array.from(unique.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [filterOptions, draftFilters.courseId]);

  const hasRequiredDraftFilters = useMemo(
    () => hasRequiredFilters(draftFilters),
    [draftFilters]
  );

  const clearReportState = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const updateDraftFilter = useCallback(
    (key: keyof MarksReportFilters, value: string) => {
      setDraftFilters((current) => {
        const updated = { ...current, [key]: value };
        if (key === "academicTermId") {
          updated.programType = "";
          updated.semesterId = "";
          updated.courseId = "";
          updated.sectionId = "";
        } else if (key === "programType") {
          updated.semesterId = "";
          updated.courseId = "";
          updated.sectionId = "";
        } else if (key === "semesterId") {
          updated.courseId = "";
          updated.sectionId = "";
        } else if (key === "courseId") {
          updated.sectionId = "";
        }
        return updated;
      });

      if (hasRunReport) setFiltersChangedAfterRun(true);
      clearReportState();
    },
    [clearReportState, hasRunReport]
  );

  const onGetReport = useCallback(() => {
    if (!hasRequiredDraftFilters) {
      toast.error("Please select all filters");
      return;
    }
    setAppliedFilters(draftFilters);
    setHasRunReport(true);
    setFiltersChangedAfterRun(false);
    setRunToken((current) => current + 1);
  }, [draftFilters, hasRequiredDraftFilters]);

  const onResetFilters = useCallback(() => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setHasRunReport(false);
    setFiltersChangedAfterRun(false);
    setRunToken(0);
    clearReportState();
  }, [clearReportState]);

  const getHeaderMetadata = useCallback(() => {
    if (!reportData) return [];
    return [
      `Course: ${reportData.course.code} - ${reportData.course.name}`,
      `Semester: ${reportData.semester.semesterNumber}`,
      `Academic Term: ${reportData.semester.academicTerm.type} ${reportData.semester.academicTerm.year}`,
      `Min Required CIE: ${reportData.course.cumulativeMinMarks} (${reportData.course.cieEligibilityPercent}%)`,
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

    const assessmentHeaders = reportData.assessments.map((a) => a.title);
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
      ...reportData.assessments.map((a) => {
        const score = student.assessments.find((s) => s.assessmentId === a.id);
        return score?.totalMarks != null
          ? `${score.totalMarks}/${a.totalMarks}`
          : "-";
      }),
      student.cieTotal != null ? student.cieTotal.toString() : "-",
      `${reportData.course.cumulativeMinMarks} (${reportData.course.cieEligibilityPercent}%)`,
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
      (a) => `${a.title} (/${a.totalMarks})`
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
      ...reportData.assessments.map((a) => {
        const score = student.assessments.find((s) => s.assessmentId === a.id);
        return score?.totalMarks != null ? score.totalMarks.toString() : "-";
      }),
      student.cieTotal != null ? student.cieTotal.toString() : "-",
      `${reportData.course.cumulativeMinMarks} (${reportData.course.cieEligibilityPercent}%)`,
      student.status === "ELIGIBLE" ? "Eligible" : "Not Eligible",
    ]);

    const csvRows = [
      ["Marks Report"],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      ...metadata.map((m) => [m]),
      [],
      headers,
      ...rows,
    ];

    downloadCSV("marks-report.csv", csvRows);
  }, [reportData, getHeaderMetadata]);

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
    />
  );
};
