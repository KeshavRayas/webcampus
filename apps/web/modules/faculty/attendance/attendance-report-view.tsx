/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FacultyAttendanceSessionDetailDTO } from "@webcampus/types/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useFacultyHandlingFilterOptions } from "../handling/use-faculty-handling";
import { AttendanceReportShell } from "./attendance-report-shell";
import type {
  AttendanceReportFilters,
  DetailedReportData,
  SessionWithCounts,
  TabType,
} from "./attendance-report-types";
import {
  getFacultyAttendanceDetailedReport,
  getFacultyAttendanceSessionDetail,
} from "./faculty-attendance-api";
import { SessionDetailModal } from "./session-detail-modal";
import {
  useFacultyAttendanceFilterOptions,
  useFacultyAttendanceSessions,
} from "./use-faculty-attendance";

// Extend filters locally to support the upcoming backend batchId schema changes
type ExtendedFilters = AttendanceReportFilters & { batchId?: string };

const EMPTY_FILTERS: ExtendedFilters = {
  academicTermId: "",
  programType: "",
  semesterId: "",
  courseId: "",
  sectionId: "",
  batchId: undefined,
};

const hasRequiredFilters = (filters: ExtendedFilters) =>
  Boolean(
    filters.academicTermId &&
      filters.programType &&
      filters.semesterId &&
      filters.courseId &&
      filters.sectionId
  );

const COURSE_SELECTION_DELIMITER = "::";

const toCourseSelectionKey = (courseId: string, batchId?: string) => {
  return `${courseId}${COURSE_SELECTION_DELIMITER}${batchId ?? "theory"}`;
};

const parseCourseSelectionKey = (value: string) => {
  const [courseId = "", rawBatchId] = value.split(COURSE_SELECTION_DELIMITER);
  return {
    courseId,
    batchId: rawBatchId && rawBatchId !== "theory" ? rawBatchId : undefined,
  };
};

const parseSectionSelectionKey = (value: string) => {
  const [sectionId = "", rawBatchId] = value.split(COURSE_SELECTION_DELIMITER);
  return {
    sectionId,
    batchId: rawBatchId && rawBatchId !== "theory" ? rawBatchId : undefined,
  };
};

const formatCourseDropdownLabel = (
  code: string,
  name: string,
  labBatchNumber?: number
) => {
  if (!labBatchNumber) return `${code} - ${name}`;
  return `${code}-${name}(Lab Batch ${labBatchNumber})`;
};

// Helper for CSV Generation
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

export const AttendanceReportView = () => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>("status");
  const [draftFilters, setDraftFilters] =
    useState<ExtendedFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<ExtendedFilters>(EMPTY_FILTERS);

  const [hasRunReport, setHasRunReport] = useState(false);
  const [filtersChangedAfterRun, setFiltersChangedAfterRun] = useState(false);
  const [runToken, setRunToken] = useState(0);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [sessionDetailsMap, setSessionDetailsMap] = useState<
    Record<string, FacultyAttendanceSessionDetailDTO>
  >({});
  const [detailedReportData, setDetailedReportData] = useState<
    DetailedReportData | undefined
  >();
  const [isLoadingDetailed, setIsLoadingDetailed] = useState(false);
  const [percentageFrom, setPercentageFrom] = useState("0");
  const [percentageTo, setPercentageTo] = useState("100");

  const detailedReportAbortRef = useRef<AbortController | null>(null);

  const { data: attendanceFilterOptions } = useFacultyAttendanceFilterOptions();
  const { data: handlingFilterOptions } =
    useFacultyHandlingFilterOptions("courses");

  const academicTerms = handlingFilterOptions?.academicTerms ?? [];

  const semestersForTerm = useMemo(() => {
    const allSemesters = handlingFilterOptions?.semesters ?? [];
    if (!draftFilters.academicTermId) return [];
    return allSemesters.filter(
      (sem) => sem.academicTermId === draftFilters.academicTermId
    );
  }, [handlingFilterOptions?.semesters, draftFilters.academicTermId]);

  const filteredSemesters = useMemo(() => {
    if (!draftFilters.programType) return semestersForTerm;
    return semestersForTerm.filter(
      (sem) => sem.programType === draftFilters.programType
    );
  }, [semestersForTerm, draftFilters.programType]);

  // --- LAB BATCH PARSING LOGIC ---
  const assignmentOptions = useMemo(() => {
    const courses = attendanceFilterOptions?.courses ?? [];
    const sections = attendanceFilterOptions?.sections ?? [];
    const courseById = new Map(courses.map((course) => [course.id, course]));

    return sections
      .map((section) => {
        const course = courseById.get(section.courseId);
        if (!course) return null;

        const selectionKey = toCourseSelectionKey(course.id, section.batchId);
        return {
          selectionKey,
          courseId: course.id,
          sectionId: section.id,
          batchId: section.batchId,
          sectionName: section.name,
          courseCode: course.code,
          courseName: course.name,
          labBatchNumber: section.labBatchNumber,
          courseLabel: formatCourseDropdownLabel(
            course.code,
            course.name,
            section.labBatchNumber
          ),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [attendanceFilterOptions]);

  const courseOptions = useMemo(() => {
    const optionsByKey = new Map<
      string,
      { id: string; name: string; label: string; code: string }
    >();
    for (const assignment of assignmentOptions) {
      optionsByKey.set(assignment.selectionKey, {
        id: assignment.selectionKey,
        name: assignment.courseName,
        label: assignment.courseLabel,
        code: assignment.courseCode,
      });
    }
    return Array.from(optionsByKey.values());
  }, [assignmentOptions]);

  const sectionsForSelectedCourse = useMemo(() => {
    const selectedCourse = parseCourseSelectionKey(draftFilters.courseId);
    const filteredAssignments = assignmentOptions.filter((assignment) => {
      if (!selectedCourse.courseId) return true;
      if (assignment.courseId !== selectedCourse.courseId) return false;
      return (assignment.batchId ?? undefined) === selectedCourse.batchId;
    });

    return filteredAssignments.map((assignment) => ({
      id: `${assignment.sectionId}${COURSE_SELECTION_DELIMITER}${assignment.batchId ?? "theory"}`,
      name: assignment.sectionName,
      courseId: assignment.courseId,
    }));
  }, [assignmentOptions, draftFilters.courseId]);
  // -------------------------------

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

  const cancelAndClearReportQueries = useCallback(() => {
    void queryClient.cancelQueries({
      queryKey: ["faculty-attendance", "sessions", "report"],
    });
    queryClient.removeQueries({
      queryKey: ["faculty-attendance", "sessions", "report"],
    });
  }, [queryClient]);

  const cancelDetailedReportRequest = useCallback(() => {
    detailedReportAbortRef.current?.abort();
    detailedReportAbortRef.current = null;
  }, []);

  const clearReportState = useCallback(() => {
    cancelDetailedReportRequest();
    setIsLoadingDetailed(false);
    setSelectedSessionId(null);
    setSessionDetailsMap({});
    setDetailedReportData(undefined);
    cancelAndClearReportQueries();
  }, [cancelAndClearReportQueries, cancelDetailedReportRequest]);

  // NOTE: When backend schema is updated, ensure `batchId` is passed into this hook if supported
  const {
    data: sessionsData,
    isError: isErrorSessions,
    error: errorSessions,
  } = useFacultyAttendanceSessions(
    {
      courseId:
        parseCourseSelectionKey(appliedFilters.courseId).courseId || undefined,
      sectionId:
        parseSectionSelectionKey(appliedFilters.sectionId).sectionId ||
        undefined,
      // batchId: parseCourseSelectionKey(appliedFilters.courseId).batchId,
      page: 1,
      limit: 10,
    },
    shouldShowReportResults,
    { queryKeySuffix: ["report", runToken], staleTime: 0 }
  );

  useEffect(() => {
    if (!shouldShowReportResults || !sessionsData?.items?.length) {
      setSessionDetailsMap({});
      return;
    }

    Promise.all(
      sessionsData.items.map(async (session) => {
        try {
          return {
            id: session.id,
            detail: await getFacultyAttendanceSessionDetail({
              sessionId: session.id,
            }),
          };
        } catch (err) {
          console.log(err);
          return { id: session.id, detail: null };
        }
      })
    ).then((results) => {
      const detailsMap: Record<string, FacultyAttendanceSessionDetailDTO> = {};
      for (const result of results) {
        if (result.detail) detailsMap[result.id] = result.detail;
      }
      setSessionDetailsMap(detailsMap);
    });
  }, [sessionsData?.items, shouldShowReportResults]);

  useEffect(() => {
    if (!isErrorSessions) return;
    toast.error(errorSessions?.message || "Failed to load attendance sessions");
  }, [isErrorSessions, errorSessions]);

  useEffect(() => {
    if (activeTab !== "detailed" && activeTab !== "percentage") {
      cancelDetailedReportRequest();
      setIsLoadingDetailed(false);
      setDetailedReportData(undefined);
      return;
    }

    if (
      !shouldShowReportResults ||
      !appliedFilters.courseId ||
      !appliedFilters.sectionId
    ) {
      cancelDetailedReportRequest();
      setIsLoadingDetailed(false);
      setDetailedReportData(undefined);
      return;
    }

    cancelDetailedReportRequest();
    const controller = new AbortController();
    detailedReportAbortRef.current = controller;
    setIsLoadingDetailed(true);

    getFacultyAttendanceDetailedReport(
      {
        courseId: parseCourseSelectionKey(appliedFilters.courseId).courseId,
        sectionId: parseSectionSelectionKey(appliedFilters.sectionId).sectionId,
        // batchId: parseCourseSelectionKey(appliedFilters.courseId).batchId, // Uncomment when backend supports it
      },
      controller.signal
    )
      .then((data) => {
        if (!controller.signal.aborted) setDetailedReportData(data);
      })
      .catch((err) => {
        if (
          controller.signal.aborted ||
          err?.name === "CanceledError" ||
          err?.name === "AbortError"
        )
          return;
        toast.error(err.message || "Failed to load detailed report");
        setDetailedReportData(undefined);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingDetailed(false);
        if (detailedReportAbortRef.current === controller)
          detailedReportAbortRef.current = null;
      });
  }, [
    activeTab,
    appliedFilters.courseId,
    appliedFilters.sectionId,
    cancelDetailedReportRequest,
    shouldShowReportResults,
  ]);

  const statusReportData = useMemo<SessionWithCounts[]>(() => {
    if (!shouldShowReportResults || !sessionsData?.items) return [];

    return sessionsData.items.map((session) => {
      const detail = sessionDetailsMap[session.id];
      if (!detail)
        return {
          ...session,
          totalStudents: 0,
          presentCount: 0,
          absentCount: 0,
          percentage: 0,
        } as SessionWithCounts;

      const totalStudents = detail.students.length;
      const presentCount = detail.students.filter(
        (s) => s.status === "PRESENT"
      ).length;
      const absentCount = detail.students.filter(
        (s) => s.status === "ABSENT"
      ).length;
      const percentage =
        totalStudents > 0
          ? Math.round((presentCount / totalStudents) * 100)
          : 0;

      return {
        ...session,
        totalStudents,
        presentCount,
        absentCount,
        percentage,
      } as SessionWithCounts;
    });
  }, [sessionsData, sessionDetailsMap, shouldShowReportResults]);

  const percentageReportData = useMemo(() => {
    if (!detailedReportData) return undefined;

    const from = percentageFrom ? Number(percentageFrom) : 0;
    const to = percentageTo ? Number(percentageTo) : 100;

    if (from > to) return detailedReportData;

    const filteredStudents = detailedReportData.students.filter(
      (student) => student.percentage >= from && student.percentage <= to
    );

    return { ...detailedReportData, students: filteredStudents };
  }, [detailedReportData, percentageFrom, percentageTo]);

  const updateDraftFilter = useCallback(
    (key: keyof ExtendedFilters, value: string) => {
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
    setAppliedFilters(draftFilters);
    setHasRunReport(true);
    setFiltersChangedAfterRun(false);
    setRunToken((current) => current + 1);
  }, [draftFilters]);

  const onResetFilters = useCallback(() => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setHasRunReport(false);
    setFiltersChangedAfterRun(false);
    setRunToken(0);
    setPercentageFrom("0");
    setPercentageTo("100");
    clearReportState();
  }, [clearReportState]);

  // --- HEADER METADATA GENERATOR ---
  const getHeaderMetadata = useCallback(() => {
    const term =
      academicTerms.find((t) => t.id === draftFilters.academicTermId)?.year ||
      "N/A";
    const progType = draftFilters.programType || "N/A";
    const sem =
      filteredSemesters.find((s) => s.id === draftFilters.semesterId)
        ?.semesterNumber || "N/A";
    const course =
      courseOptions.find((c) => c.id === draftFilters.courseId)?.label || "N/A";
    const section =
      sectionsForSelectedCourse.find((s) => s.id === draftFilters.sectionId)
        ?.name || "N/A";

    // Safely cast to any to avoid DTO strictness issues if facultyName isn't technically in the interface
    const facultyName =
      (sessionsData?.items?.[0] as any)?.facultyName || "Faculty Member";

    return [
      `Academic Term: ${term}`,
      `Program Type: ${progType}`,
      `Semester: ${sem}`,
      `Course: ${course}`,
      `Section: ${section}`,
      `Faculty Name: ${facultyName}`,
    ];
  }, [
    academicTerms,
    draftFilters,
    filteredSemesters,
    courseOptions,
    sectionsForSelectedCourse,
    sessionsData,
  ]);

  // --- DETAILED REPORTS ---
  const handleDownloadPDF = useCallback(() => {
    if (!detailedReportData || !detailedReportData.students.length) return;
    const doc = new jsPDF({ orientation: "landscape" });
    const metadata = getHeaderMetadata();

    doc.setFontSize(16);
    doc.text("Attendance Detailed Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

    // Print Header Metadata
    let yPos = 30;
    metadata.forEach((text, index) => {
      // Split into two columns for layout
      const xPos = index % 2 === 0 ? 14 : 140;
      doc.text(text, xPos, yPos);
      if (index % 2 !== 0) yPos += 6;
    });

    const headers = [
      "USN",
      "Student Name",
      ...detailedReportData.sessions.map((s) =>
        new Date(s.sessionDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      ),
      "Total",
      "Cond.",
      "Present",
      "Absent",
      "%",
      "Status",
    ];

    const rows = detailedReportData.students.map((student) => [
      student.usn,
      student.name,
      ...student.sessionStatuses.map((status) =>
        status === "PRESENT" ? "P" : "A"
      ),
      student.totalSessions.toString(),
      student.condonationStatus,
      student.presentSessions.toString(),
      student.absentSessions.toString(),
      `${student.percentage}%`,
      student.status,
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
      didParseCell: function (data) {
        if (
          data.section === "body" &&
          data.column.index >= 2 &&
          data.column.index < 2 + detailedReportData.sessions.length
        ) {
          const val = data.cell.raw as string;
          data.cell.styles.textColor =
            val === "P" ? [39, 174, 96] : [192, 57, 43];
        }
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

    doc.save("attendance-detailed-report.pdf");
  }, [detailedReportData, getHeaderMetadata]);

  const handleDownloadExcel = useCallback(() => {
    if (!detailedReportData || !detailedReportData.students.length) return;
    const metadata = getHeaderMetadata();

    const headers = [
      "USN",
      "Student Name",
      ...detailedReportData.sessions.map((s) =>
        new Date(s.sessionDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      ),
      "Total",
      "Condonation",
      "Present",
      "Absent",
      "Percentage",
      "Status",
    ];

    const rows = detailedReportData.students.map((student) => [
      student.usn,
      student.name,
      ...student.sessionStatuses.map((status) =>
        status === "PRESENT" ? "P" : "A"
      ),
      student.totalSessions.toString(),
      student.condonationStatus,
      student.presentSessions.toString(),
      student.absentSessions.toString(),
      `${student.percentage}%`,
      student.status,
    ]);

    // Prepend metadata rows to Excel
    const csvRows = [
      ["Attendance Detailed Report"],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [], // Empty row
      ...metadata.map((m) => [m]), // Add metadata parameters
      [],
      headers,
      ...rows,
    ];

    downloadCSV("attendance-detailed-report.csv", csvRows);
  }, [detailedReportData, getHeaderMetadata]);

  // --- PERCENTAGE REPORTS ---
  const handleDownloadPercentagePDF = useCallback(() => {
    if (!percentageReportData || !percentageReportData.students.length) return;
    const doc = new jsPDF({ orientation: "landscape" });
    const metadata = getHeaderMetadata();

    doc.setFontSize(16);
    doc.text("Attendance Percentage Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

    let yPos = 30;
    if (percentageFrom || percentageTo) {
      doc.text(
        `Filter: ${percentageFrom || "0"}% - ${percentageTo || "100"}%`,
        14,
        yPos
      );
      yPos += 6;
    }

    metadata.forEach((text, index) => {
      const xPos = index % 2 === 0 ? 14 : 140;
      doc.text(text, xPos, yPos);
      if (index % 2 !== 0) yPos += 6;
    });

    const headers = [
      "USN",
      "Student Name",
      "Total Sessions",
      "Condonation",
      "Present Sessions",
      "Absent Sessions",
      "Percentage",
      "Status",
    ];
    const rows = percentageReportData.students.map((student) => [
      student.usn,
      student.name,
      student.totalSessions.toString(),
      student.condonationStatus === "APPROVED" ? "Condoned" : "Not Condoned",
      student.presentSessions.toString(),
      student.absentSessions.toString(),
      `${student.percentage}%`,
      student.status,
    ]);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: yPos + 4,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 35 } },
      didParseCell: function (data) {
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

    doc.save("attendance-percentage-report.pdf");
  }, [percentageReportData, percentageFrom, percentageTo, getHeaderMetadata]);

  const handleDownloadPercentageExcel = useCallback(() => {
    if (!percentageReportData || !percentageReportData.students.length) return;
    const metadata = getHeaderMetadata();

    const headers = [
      "USN",
      "Student Name",
      "Total Sessions",
      "Condonation",
      "Present Sessions",
      "Absent Sessions",
      "Percentage",
      "Status",
    ];
    const rows = percentageReportData.students.map((student) => [
      student.usn,
      student.name,
      student.totalSessions.toString(),
      student.condonationStatus === "APPROVED" ? "Condoned" : "Not Condoned",
      student.presentSessions.toString(),
      student.absentSessions.toString(),
      `${student.percentage}%`,
      student.status,
    ]);

    const csvRows = [
      ["Attendance Percentage Report"],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [`Filter: ${percentageFrom || "0"}% - ${percentageTo || "100"}%`],
      [],
      ...metadata.map((m) => [m]),
      [],
      headers,
      ...rows,
    ];

    downloadCSV("attendance-percentage-report.csv", csvRows);
  }, [percentageReportData, percentageFrom, percentageTo, getHeaderMetadata]);

  const handlePercentageFilterChange = useCallback(
    (key: "percentageFrom" | "percentageTo", value: string) => {
      if (key === "percentageFrom") setPercentageFrom(value);
      else setPercentageTo(value);
    },
    []
  );

  return (
    <>
      <AttendanceReportShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        draftFilters={draftFilters}
        onDraftChange={updateDraftFilter}
        academicTerms={academicTerms}
        semesters={filteredSemesters}
        courses={courseOptions}
        sections={sectionsForSelectedCourse}
        hasRequiredFilters={hasRequiredDraftFilters}
        hasRunReport={hasRunReport}
        filtersChangedAfterRun={filtersChangedAfterRun}
        statusReportData={statusReportData}
        isErrorSessions={isErrorSessions}
        errorSessions={errorSessions}
        onGetReport={onGetReport}
        onResetFilters={onResetFilters}
        onSessionSelect={setSelectedSessionId}
        detailedReportData={detailedReportData}
        isLoadingDetailed={isLoadingDetailed}
        onDownloadDetailedPDF={handleDownloadPDF}
        onDownloadDetailedExcel={handleDownloadExcel}
        onDownloadPercentageExcel={handleDownloadPercentageExcel}
        percentageReportData={percentageReportData}
        percentageFrom={percentageFrom}
        percentageTo={percentageTo}
        onPercentageFilterChange={handlePercentageFilterChange}
        onDownloadPercentagePDF={handleDownloadPercentagePDF}
      />

      <SessionDetailModal
        isOpen={!!selectedSessionId}
        onOpenChange={(open) => {
          if (!open) setSelectedSessionId(null);
        }}
        sessionId={selectedSessionId}
        sessionDetails={sessionDetailsMap}
      />
    </>
  );
};
