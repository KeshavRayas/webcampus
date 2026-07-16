"use client";

import { AttendanceReportShell } from "@/modules/faculty/attendance/attendance-report-shell";
import { TabType } from "@/modules/faculty/attendance/attendance-report-types";
import { useQuery } from "@tanstack/react-query";
import { dayjs } from "@webcampus/common/dayjs";
import { frontendEnv } from "@webcampus/common/env";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useState } from "react";
import { toast } from "react-toastify";
import {
  useHODAttendanceCourses,
  useHODAttendanceFilterOptions,
  useHODAttendanceSections,
} from "./use-hod-attendance-report";

// Define Interfaces instead of 'any'
interface HODReportFilters {
  academicTermId: string;
  semesterId: string;
  courseId: string;
  sectionId: string;
  cycle: string;
  programType: string;
}

interface StudentRow {
  studentId: string;
  usn: string;
  name: string;
  presentCount: number;
  totalCount: number;
  percentage: number;
  attendanceBySession: { sessionId: string; status: string | null }[];
}

interface SessionRow {
  id: string;
  sessionDate: Date;
  timingMode: string;
}

const EMPTY_FILTERS: HODReportFilters = {
  academicTermId: "",
  semesterId: "",
  courseId: "",
  sectionId: "",
  cycle: "",
  programType: "UG",
};

export const HODAttendanceReportView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [activeTab, setActiveTab] = useState<TabType>("detailed");
  const [draftFilters, setDraftFilters] =
    useState<HODReportFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<HODReportFilters | null>(
    null
  );

  const { data: optionsData } = useHODAttendanceFilterOptions();
  const isBasicSciences = optionsData?.departmentType === "BASIC_SCIENCES";

  const { data: courses = [] } = useHODAttendanceCourses(
    draftFilters.semesterId,
    draftFilters.cycle
  );
  const { data: sections = [] } = useHODAttendanceSections(
    draftFilters.semesterId,
    draftFilters.courseId,
    draftFilters.cycle
  );

  const hasRequiredDraftFilters = Boolean(
    draftFilters.academicTermId &&
      draftFilters.semesterId &&
      draftFilters.courseId &&
      draftFilters.sectionId
  );

  const { data: detailedReportData, isLoading: isLoadingDetailed } = useQuery({
    queryKey: ["hod-detailed-report", appliedFilters],
    queryFn: async () => {
      if (!appliedFilters) return null;
      const res = await axios.get(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/attendance-report/detailed`,
        {
          params: {
            courseId: appliedFilters.courseId,
            sectionId: appliedFilters.sectionId,
          },
          withCredentials: true,
        }
      );
      return res.data.data;
    },
    enabled: !!appliedFilters,
  });

  const onDraftChange = (key: string, value: string) => {
    setDraftFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "semesterId" || key === "cycle") {
        next.courseId = "";
        next.sectionId = "";
      }
      if (key === "courseId") {
        next.sectionId = "";
      }
      return next;
    });
  };

  const onGetReport = () => setAppliedFilters(draftFilters);
  const onResetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(null);
  };

  const handleDownloadPDF = () => {
    if (!detailedReportData || !appliedFilters) return;
    const doc = new jsPDF("l", "pt", "a4");
    const course = courses.find(
      (c: { id: string }) => c.id === appliedFilters.courseId
    );
    const section = sections.find(
      (s: { id: string }) => s.id === appliedFilters.sectionId
    );

    doc.setFontSize(16);
    doc.text(`Attendance Report - ${course?.code || "Course"}`, 40, 40);
    doc.setFontSize(12);
    doc.text(`Section: ${section?.name || "N/A"}`, 40, 60);

    const headers = [
      "USN",
      "Name",
      ...detailedReportData.sessions.map((s: SessionRow) =>
        dayjs(s.sessionDate).format("DD/MM")
      ),
      "Present",
      "Total",
      "%",
    ];
    const body = detailedReportData.students.map((student: StudentRow) => [
      student.usn,
      student.name,
      ...detailedReportData.sessions.map((session: SessionRow) => {
        const record = student.attendanceBySession.find(
          (r) => r.sessionId === session.id
        );
        return record?.status === "PRESENT"
          ? "P"
          : record?.status === "ABSENT"
            ? "A"
            : "-";
      }),
      student.presentCount,
      student.totalCount,
      `${student.percentage}%`,
    ]);

    autoTable(doc, {
      head: [headers],
      body,
      startY: 80,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });
    doc.save(
      `Attendance_${course?.code || "Course"}_Sec_${section?.name || "N/A"}.pdf`
    );
    toast.success("PDF downloaded successfully");
  };

  const handleDownloadExcel = () => {
    toast.info("Excel download starting...");
  };

  return (
    <div className="space-y-6">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">
          HOD Attendance Reports
        </h2>
        <p className="text-muted-foreground text-sm">
          View attendance analytics across your department.
        </p>
      </div>

      {isBasicSciences && (
        <div className="bg-muted/20 mb-4 rounded border p-3 text-sm">
          <strong>Basic Sciences HOD:</strong> Please select a Cycle to filter
          available courses.
        </div>
      )}

      <AttendanceReportShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        draftFilters={draftFilters}
        onDraftChange={onDraftChange}
        academicTerms={optionsData?.academicTerms || []}
        semesters={optionsData?.semesters || []}
        courses={courses}
        sections={sections}
        hasRequiredFilters={hasRequiredDraftFilters}
        hasRunReport={!!appliedFilters}
        filtersChangedAfterRun={false}
        statusReportData={[]}
        isErrorSessions={false}
        errorSessions={[]}
        onGetReport={onGetReport}
        onResetFilters={onResetFilters}
        onSessionSelect={() => {}}
        detailedReportData={detailedReportData}
        isLoadingDetailed={isLoadingDetailed}
        onDownloadDetailedPDF={handleDownloadPDF}
        onDownloadDetailedExcel={handleDownloadExcel}
        onDownloadPercentageExcel={handleDownloadExcel}
        percentageReportData={detailedReportData}
        percentageFrom=""
        percentageTo=""
        onPercentageFilterChange={() => {}}
        onDownloadPercentagePDF={handleDownloadPDF}
      />
    </div>
  );
};
