"use client";

import { AttendanceReportShell } from "@/modules/faculty/attendance/attendance-report-shell";
import type {
  AttendanceReportFilters,
  DetailedReportData,
  SessionWithCounts,
  TabType,
} from "@/modules/faculty/attendance/attendance-report-types";
import { SessionDetailModal } from "@/modules/faculty/attendance/session-detail-modal";
import type { FacultyAttendanceSessionDetailDTO } from "@webcampus/types/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  useHODAttendanceCourses,
  useHODAttendanceDetailedReport,
  useHODAttendanceFilterOptions,
  useHODAttendanceSections,
  type HODAttendanceDetailedRaw,
} from "./use-hod-attendance-report";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

type HODAttendanceReportFilters = AttendanceReportFilters & {
  cycle: string;
};

const EMPTY_FILTERS: HODAttendanceReportFilters = {
  academicTermId: "",
  programType: "",
  semesterId: "",
  courseId: "",
  sectionId: "",
  cycle: "",
};

const hasRequiredFilters = (filters: HODAttendanceReportFilters) =>
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

const getEligibilityStatus = (
  percentage: number,
  condonationStatus: string
): "Eligible" | "Not Eligible" => {
  if (percentage >= 85) return "Eligible";
  if (percentage >= 75 && condonationStatus === "APPROVED") return "Eligible";
  return "Not Eligible";
};

const mapDetailedReportData = (
  raw: HODAttendanceDetailedRaw | undefined
): DetailedReportData | undefined => {
  if (!raw) return undefined;

  return {
    sessions: raw.sessions.map((session) => ({
      id: session.id,
      sessionDate: String(session.sessionDate),
    })),
    students: raw.students.map((student) => {
      const sessionStatuses = raw.sessions.map((session) => {
        const record = student.attendanceBySession.find(
          (entry) => entry.sessionId === session.id
        );
        return record?.status === "PRESENT"
          ? ("PRESENT" as const)
          : ("ABSENT" as const);
      });
      const condonationStatus = "NOT_REQUESTED" as const;
      const presentSessions = student.presentCount;
      const absentSessions =
        student.absentCount ??
        Math.max(student.totalCount - presentSessions, 0);
      const totalSessions = student.totalCount;
      const percentage = student.percentage;
      const status = getEligibilityStatus(percentage, condonationStatus);

      return {
        studentId: student.studentId,
        usn: student.usn,
        name: student.name,
        sessionStatuses,
        condonationStatus,
        totalSessions,
        presentSessions,
        absentSessions,
        percentage,
        status,
      };
    }),
  };
};

const buildStatusReportData = (
  raw: HODAttendanceDetailedRaw | undefined,
  course?: { code: string; name: string },
  section?: { name: string },
  courseId?: string,
  sectionId?: string
): SessionWithCounts[] => {
  if (!raw?.sessions.length) return [];

  return raw.sessions.map((session) => {
    let presentCount = 0;
    let absentCount = 0;
    let totalStudents = 0;

    for (const student of raw.students) {
      const record = student.attendanceBySession.find(
        (entry) => entry.sessionId === session.id
      );
      if (record?.status === "PRESENT" || record?.status === "ABSENT") {
        totalStudents += 1;
        if (record.status === "PRESENT") presentCount += 1;
        else absentCount += 1;
      }
    }

    return {
      id: session.id,
      courseId: courseId ?? "",
      sectionId: sectionId ?? "",
      sessionDate: String(session.sessionDate),
      timingCode: session.timingMode ?? "",
      timingLabel: session.timingMode ?? "-",
      timingStartTime: "",
      timingEndTime: "",
      courseCode: course?.code ?? "",
      courseName: course?.name ?? "",
      sectionName: section?.name ?? "",
      createdAt: String(session.sessionDate),
      totalStudents,
      presentCount,
      absentCount,
      percentage:
        totalStudents > 0
          ? Math.round((presentCount / totalStudents) * 100)
          : 0,
    };
  });
};

const buildSessionDetailsMap = (
  raw: HODAttendanceDetailedRaw | undefined,
  course?: { code: string; name: string },
  section?: { name: string },
  courseId?: string,
  sectionId?: string
): Record<string, FacultyAttendanceSessionDetailDTO> => {
  if (!raw) return {};

  const detailsMap: Record<string, FacultyAttendanceSessionDetailDTO> = {};

  for (const session of raw.sessions) {
    detailsMap[session.id] = {
      session: {
        id: session.id,
        courseId: courseId ?? "",
        sectionId: sectionId ?? "",
        sessionDate: String(session.sessionDate),
        timingCode: session.timingMode ?? "",
        timingLabel: session.timingMode ?? "-",
        timingStartTime: "",
        timingEndTime: "",
        courseCode: course?.code ?? "",
        courseName: course?.name ?? "",
        sectionName: section?.name ?? "",
        createdAt: String(session.sessionDate),
      },
      students: raw.students.map((student) => ({
        studentId: student.studentId,
        usn: student.usn,
        name: student.name,
        status:
          student.attendanceBySession.find(
            (entry) => entry.sessionId === session.id
          )?.status === "PRESENT"
            ? "PRESENT"
            : student.attendanceBySession.find(
                  (entry) => entry.sessionId === session.id
                )?.status === "ABSENT"
              ? "ABSENT"
              : "ABSENT",
      })),
    };
  }

  return detailsMap;
};

export const HodAttendanceReportView = () => {
  const [activeTab, setActiveTab] = useState<TabType>("status");
  const [draftFilters, setDraftFilters] =
    useState<HODAttendanceReportFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<HODAttendanceReportFilters>(EMPTY_FILTERS);
  const [hasRunReport, setHasRunReport] = useState(false);
  const [filtersChangedAfterRun, setFiltersChangedAfterRun] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [percentageFrom, setPercentageFrom] = useState("0");
  const [percentageTo, setPercentageTo] = useState("100");

  const { data: optionsData } = useHODAttendanceFilterOptions();
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

  const { data: courses = [] } = useHODAttendanceCourses(
    draftFilters.semesterId,
    isBasicSciences && isSemesterOneOrTwo ? draftFilters.cycle : ""
  );
  const { data: sections = [] } = useHODAttendanceSections(
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
    data: rawDetailedReport,
    isLoading: isLoadingDetailed,
    isError: isErrorDetailed,
    error: errorDetailed,
  } = useHODAttendanceDetailedReport(
    shouldShowReportResults
      ? {
          courseId: appliedFilters.courseId,
          sectionId: appliedFilters.sectionId,
        }
      : null,
    shouldShowReportResults
  );

  const appliedCourse = useMemo(
    () => courses.find((course) => course.id === appliedFilters.courseId),
    [courses, appliedFilters.courseId]
  );
  const appliedSection = useMemo(
    () => sections.find((section) => section.id === appliedFilters.sectionId),
    [sections, appliedFilters.sectionId]
  );

  const detailedReportData = useMemo(
    () => mapDetailedReportData(rawDetailedReport),
    [rawDetailedReport]
  );

  const statusReportData = useMemo(
    () =>
      buildStatusReportData(
        rawDetailedReport,
        appliedCourse,
        appliedSection,
        appliedFilters.courseId,
        appliedFilters.sectionId
      ),
    [
      rawDetailedReport,
      appliedCourse,
      appliedSection,
      appliedFilters.courseId,
      appliedFilters.sectionId,
    ]
  );

  const sessionDetailsMap = useMemo(
    () =>
      buildSessionDetailsMap(
        rawDetailedReport,
        appliedCourse,
        appliedSection,
        appliedFilters.courseId,
        appliedFilters.sectionId
      ),
    [
      rawDetailedReport,
      appliedCourse,
      appliedSection,
      appliedFilters.courseId,
      appliedFilters.sectionId,
    ]
  );

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

  useEffect(() => {
    if (!isErrorDetailed) return;
    toast.error(
      errorDetailed instanceof Error
        ? errorDetailed.message
        : "Failed to load attendance report"
    );
  }, [isErrorDetailed, errorDetailed]);

  const updateDraftFilter = useCallback(
    (key: string, value: string) => {
      setDraftFilters((current) => {
        const updated = { ...current, [key]: value };
        if (key === "academicTermId") {
          updated.programType = "";
          updated.semesterId = "";
          updated.courseId = "";
          updated.sectionId = "";
          updated.cycle = "";
        } else if (key === "programType") {
          updated.semesterId = "";
          updated.courseId = "";
          updated.sectionId = "";
          updated.cycle = "";
        } else if (key === "semesterId") {
          updated.courseId = "";
          updated.sectionId = "";
          updated.cycle = "";
        } else if (key === "courseId") {
          updated.sectionId = "";
        } else if (key === "cycle") {
          updated.courseId = "";
          updated.sectionId = "";
        }
        return updated;
      });

      if (hasRunReport) setFiltersChangedAfterRun(true);
    },
    [hasRunReport]
  );

  const onGetReport = useCallback(() => {
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
  }, [draftFilters, isBasicSciences, isSemesterOneOrTwo]);

  const onResetFilters = useCallback(() => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setHasRunReport(false);
    setFiltersChangedAfterRun(false);
    setPercentageFrom("0");
    setPercentageTo("100");
    setSelectedSessionId(null);
  }, []);

  const getHeaderMetadata = useCallback(() => {
    const term =
      optionsData?.academicTerms.find(
        (item) => item.id === appliedFilters.academicTermId
      )?.year || "N/A";
    const progType = appliedFilters.programType || "N/A";
    const sem =
      filteredSemesters.find((item) => item.id === appliedFilters.semesterId)
        ?.semesterNumber || "N/A";
    const course =
      courses.find((item) => item.id === appliedFilters.courseId)?.name ||
      "N/A";
    const section =
      sections.find((item) => item.id === appliedFilters.sectionId)?.name ||
      "N/A";

    return [
      `Academic Term: ${term}`,
      `Program Type: ${progType}`,
      `Semester: ${sem}`,
      `Course: ${course}`,
      `Section: ${section}`,
      `Department HOD Report`,
    ];
  }, [
    appliedFilters,
    courses,
    filteredSemesters,
    optionsData?.academicTerms,
    sections,
  ]);

  const handleDownloadPDF = useCallback(() => {
    if (!detailedReportData || !detailedReportData.students.length) return;
    const doc = new jsPDF({ orientation: "landscape" });
    const metadata = getHeaderMetadata();

    doc.setFontSize(16);
    doc.text("Attendance Detailed Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

    let yPos = 30;
    metadata.forEach((text, index) => {
      const xPos = index % 2 === 0 ? 14 : 140;
      doc.text(text, xPos, yPos);
      if (index % 2 !== 0) yPos += 6;
    });

    const headers = [
      "USN",
      "Student Name",
      ...detailedReportData.sessions.map((session) =>
        new Date(session.sessionDate).toLocaleDateString("en-US", {
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
      ...detailedReportData.sessions.map((session) =>
        new Date(session.sessionDate).toLocaleDateString("en-US", {
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

    downloadCSV("attendance-detailed-report.csv", [
      ["Attendance Detailed Report"],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      ...metadata.map((item) => [item]),
      [],
      headers,
      ...rows,
    ]);
  }, [detailedReportData, getHeaderMetadata]);

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

    downloadCSV("attendance-percentage-report.csv", [
      ["Attendance Percentage Report"],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [`Filter: ${percentageFrom || "0"}% - ${percentageTo || "100"}%`],
      [],
      ...metadata.map((item) => [item]),
      [],
      headers,
      ...rows,
    ]);
  }, [percentageReportData, percentageFrom, percentageTo, getHeaderMetadata]);

  const handlePercentageFilterChange = useCallback(
    (key: "percentageFrom" | "percentageTo", value: string) => {
      if (key === "percentageFrom") setPercentageFrom(value);
      else setPercentageTo(value);
    },
    []
  );

  const sectionOptions = useMemo(
    () =>
      sections.map((section) => ({
        id: section.id,
        name: section.name,
        label: section.isElectiveBatch
          ? `${section.name} (Elective)`
          : section.name,
        courseId: draftFilters.courseId,
      })),
    [sections, draftFilters.courseId]
  );

  const cycleOptions = useMemo(
    () =>
      BASIC_SCIENCES_CYCLE_OPTIONS.map((cycle) => ({
        label: cycle,
        value: cycle,
      })),
    []
  );

  return (
    <>
      <AttendanceReportShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        draftFilters={draftFilters}
        onDraftChange={updateDraftFilter}
        academicTerms={optionsData?.academicTerms ?? []}
        semesters={filteredSemesters}
        courses={courses}
        sections={sectionOptions}
        hasRequiredFilters={hasRequiredDraftFilters}
        hasRunReport={hasRunReport}
        filtersChangedAfterRun={filtersChangedAfterRun}
        statusReportData={statusReportData}
        isErrorSessions={isErrorDetailed}
        errorSessions={errorDetailed}
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
        showCycleFilter={isBasicSciences && isSemesterOneOrTwo}
        cycleOptions={cycleOptions}
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
