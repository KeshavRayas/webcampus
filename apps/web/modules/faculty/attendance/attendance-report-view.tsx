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

const EMPTY_FILTERS: AttendanceReportFilters = {
  academicTermId: "",
  programType: "",
  semesterId: "",
  courseId: "",
  sectionId: "",
};

const hasRequiredFilters = (filters: AttendanceReportFilters) =>
  Boolean(
    filters.academicTermId &&
      filters.programType &&
      filters.semesterId &&
      filters.courseId &&
      filters.sectionId
  );

export const AttendanceReportView = () => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>("status");
  const [draftFilters, setDraftFilters] =
    useState<AttendanceReportFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AttendanceReportFilters>(EMPTY_FILTERS);
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

  const courses = attendanceFilterOptions?.courses ?? [];
  const sections = attendanceFilterOptions?.sections ?? [];

  const filteredSections = useMemo(() => {
    if (!draftFilters.courseId) return sections;
    return sections.filter((s) => s.courseId === draftFilters.courseId);
  }, [sections, draftFilters.courseId]);

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

  const {
    data: sessionsData,
    isError: isErrorSessions,
    error: errorSessions,
  } = useFacultyAttendanceSessions(
    {
      courseId: appliedFilters.courseId || undefined,
      sectionId: appliedFilters.sectionId || undefined,
      page: 1,
      limit: 10,
    },
    shouldShowReportResults,
    {
      queryKeySuffix: ["report", runToken],
      staleTime: 0,
    }
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
          console.error(
            `Failed to fetch detail for session ${session.id}:`,
            err
          );
          return { id: session.id, detail: null };
        }
      })
    ).then((results) => {
      const detailsMap: Record<string, FacultyAttendanceSessionDetailDTO> = {};
      for (const result of results) {
        if (result.detail) {
          detailsMap[result.id] = result.detail;
        }
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
        courseId: appliedFilters.courseId,
        sectionId: appliedFilters.sectionId,
      },
      controller.signal
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setDetailedReportData(data);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) {
          return;
        }

        if (err?.name === "CanceledError" || err?.name === "AbortError") {
          return;
        }

        toast.error(err.message || "Failed to load detailed report");
        setDetailedReportData(undefined);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingDetailed(false);
        }

        if (detailedReportAbortRef.current === controller) {
          detailedReportAbortRef.current = null;
        }
      });
  }, [
    activeTab,
    appliedFilters.courseId,
    appliedFilters.sectionId,
    cancelDetailedReportRequest,
    shouldShowReportResults,
  ]);

  useEffect(() => {
    return () => {
      cancelDetailedReportRequest();
      void queryClient.cancelQueries({
        queryKey: ["faculty-attendance", "sessions", "report"],
      });
      queryClient.removeQueries({
        queryKey: ["faculty-attendance", "sessions", "report"],
      });
    };
  }, [cancelDetailedReportRequest, queryClient]);

  const statusReportData = useMemo<SessionWithCounts[]>(() => {
    if (!shouldShowReportResults || !sessionsData?.items) return [];

    return sessionsData.items.map((session) => {
      const detail = sessionDetailsMap[session.id];
      if (!detail) {
        return {
          ...session,
          totalStudents: 0,
          presentCount: 0,
          absentCount: 0,
          percentage: 0,
        } as SessionWithCounts;
      }

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

    return {
      ...detailedReportData,
      students: filteredStudents,
    };
  }, [detailedReportData, percentageFrom, percentageTo]);

  const updateDraftFilter = useCallback(
    (key: keyof AttendanceReportFilters, value: string) => {
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

      if (hasRunReport) {
        setFiltersChangedAfterRun(true);
      }

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

  const handleDownloadPDF = useCallback(() => {
    if (!detailedReportData || !detailedReportData.students.length) return;

    const doc = new jsPDF({ orientation: "landscape" });

    const courseInfo = `${draftFilters.courseId ? "Course" : "Section"} Report`;

    doc.setFontSize(16);
    doc.text("Attendance Detailed Report", 14, 15);

    doc.setFontSize(10);
    doc.text(courseInfo, 14, 25);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);

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

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 38,
      styles: {
        fontSize: 7,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
      },
      didParseCell: function (data) {
        if (
          data.section === "body" &&
          data.column.index >= 2 &&
          data.column.index < 2 + detailedReportData.sessions.length
        ) {
          const value = data.cell.raw as string;
          if (value === "P") {
            data.cell.styles.textColor = [39, 174, 96];
          } else if (value === "A") {
            data.cell.styles.textColor = [192, 57, 43];
          }
        }

        if (
          data.section === "body" &&
          data.column.index === headers.length - 1
        ) {
          const value = data.cell.raw as string;
          if (value === "Eligible") {
            data.cell.styles.textColor = [39, 174, 96];
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [192, 57, 43];
          }
        }
      },
    });

    doc.save("attendance-detailed-report.pdf");
  }, [detailedReportData, draftFilters]);

  const handleDownloadPercentagePDF = useCallback(() => {
    if (!percentageReportData || !percentageReportData.students.length) return;

    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.text("Attendance Percentage Report", 14, 15);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 25);
    if (percentageFrom || percentageTo) {
      const filterText = `Filter: ${percentageFrom || "0"}% - ${percentageTo || "100"}%`;
      doc.text(filterText, 14, 32);
    }

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
      startY: percentageFrom || percentageTo ? 38 : 32,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
      },
      didParseCell: function (data) {
        if (
          data.section === "body" &&
          data.column.index === headers.length - 1
        ) {
          const value = data.cell.raw as string;
          if (value === "Eligible") {
            data.cell.styles.textColor = [39, 174, 96];
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [192, 57, 43];
          }
        }
      },
    });

    doc.save("attendance-percentage-report.pdf");
  }, [percentageReportData, percentageFrom, percentageTo]);

  const handlePercentageFilterChange = useCallback(
    (key: "percentageFrom" | "percentageTo", value: string) => {
      if (key === "percentageFrom") {
        setPercentageFrom(value);
      } else {
        setPercentageTo(value);
      }
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
        courses={courses}
        sections={filteredSections}
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
