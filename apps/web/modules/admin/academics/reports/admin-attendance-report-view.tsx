"use client";

import {
  AttendanceDetailedTable,
  AttendancePercentageTable,
  AttendanceStatusTable,
} from "@/components/academics/reports/attendance-tables";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import type { DetailedReportData } from "@/modules/faculty/attendance/attendance-report-types";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse } from "@webcampus/types/api";
import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import { Tabs, TabsList, TabsTrigger } from "@webcampus/ui/components/tabs";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

export type AdminAttendanceReportFiltersState = {
  departmentId: string;
  departmentName: string;
  termId: string;
  semesterId: string;
  cycle: string;
  courseId: string;
  sectionId: string;
};

const EMPTY_FILTERS: AdminAttendanceReportFiltersState = {
  departmentId: "",
  departmentName: "",
  termId: "",
  semesterId: "",
  cycle: "",
  courseId: "",
  sectionId: "",
};

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

export const AdminAttendanceReportView = ({
  fixedDepartmentId,
  fixedDepartmentName,
}: {
  fixedDepartmentId?: string;
  fixedDepartmentName?: string;
} = {}) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<
    "status" | "detailed" | "percentage"
  >("status");

  const [draftFilters, setDraftFilters] =
    useState<AdminAttendanceReportFiltersState>(() =>
      getFiltersFromSearchParams(searchParams, {
        ...EMPTY_FILTERS,
        departmentId: fixedDepartmentId ?? "",
        departmentName: fixedDepartmentName ?? "",
      })
    );
  const [appliedFilters, setAppliedFilters] =
    useState<AdminAttendanceReportFiltersState>(() =>
      getFiltersFromSearchParams(searchParams, {
        ...EMPTY_FILTERS,
        departmentId: fixedDepartmentId ?? "",
        departmentName: fixedDepartmentName ?? "",
      })
    );

  const [percentageFrom, setPercentageFrom] = useState("0");
  const [percentageTo, setPercentageTo] = useState("100");

  useEffect(() => {
    const nextFilters = getFiltersFromSearchParams(searchParams, {
      ...EMPTY_FILTERS,
      departmentId: fixedDepartmentId ?? "",
      departmentName: fixedDepartmentName ?? "",
    });
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams, fixedDepartmentId, fixedDepartmentName]);

  const { data: rawDepartments = [] } = useDepartments();
  const departments = rawDepartments.filter((d) => d.type !== "SERVICE");

  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];

  const selectedDraftTerm = terms.find(
    (term) => term.id === draftFilters.termId
  );
  const allSemestersForSelectedDraftTerm = selectedDraftTerm?.Semester ?? [];

  const selectedDraftDepartment = departments.find(
    (d) => d.name === draftFilters.departmentName
  );
  const isFirstYearDepartment =
    selectedDraftDepartment?.type === "BASIC_SCIENCES";

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: allSemestersForSelectedDraftTerm,
  });

  const semesterOptions = useMemo(() => {
    if (isFirstYearDepartment) {
      return allSemestersForSelectedDraftTerm.filter((s) =>
        FIRST_YEAR_UG_SEMESTERS.has(s.semesterNumber)
      );
    }
    const termType = selectedDraftTerm?.type;
    if (termType === "odd") {
      return allSemestersForSelectedDraftTerm.filter(
        (s) => s.semesterNumber >= 3 && s.semesterNumber % 2 === 1
      );
    }
    if (termType === "even") {
      return allSemestersForSelectedDraftTerm.filter(
        (s) => s.semesterNumber >= 4 && s.semesterNumber % 2 === 0
      );
    }
    return allSemestersForSelectedDraftTerm.filter(
      (s) => !FIRST_YEAR_UG_SEMESTERS.has(s.semesterNumber)
    );
  }, [
    allSemestersForSelectedDraftTerm,
    isFirstYearDepartment,
    selectedDraftTerm?.type,
  ]);

  const selectedDraftSemester = semesterOptions.find(
    (s) => s.id === draftFilters.semesterId
  );

  const isSemesterOneOrTwo =
    !!selectedDraftSemester &&
    FIRST_YEAR_UG_SEMESTERS.has(selectedDraftSemester.semesterNumber);

  // Fetch Courses
  const { data: rawCourses, isLoading: loadingCourses } = useQuery({
    queryKey: [
      "admin-academics-courses",
      draftFilters.departmentId,
      draftFilters.semesterId,
      draftFilters.cycle,
    ],
    queryFn: async () => {
      if (!draftFilters.departmentId || !draftFilters.semesterId) return [];
      const res = await axios.get<
        BaseResponse<{ id: string; code: string; name: string }[]>
      >(`${NEXT_PUBLIC_API_BASE_URL}/admin/academics/reports/courses`, {
        params: {
          departmentId: draftFilters.departmentId,
          semesterId: draftFilters.semesterId,
          ...(isSemesterOneOrTwo && draftFilters.cycle
            ? { cycle: draftFilters.cycle }
            : {}),
        },
        withCredentials: true,
      });
      if (res.data.status === "success") return res.data.data ?? [];
      return [];
    },
    enabled: !!draftFilters.departmentId && !!draftFilters.semesterId,
  });
  const courses = Array.isArray(rawCourses) ? rawCourses : [];

  // Fetch Sections
  const { data: rawSections, isLoading: loadingSections } = useQuery({
    queryKey: [
      "admin-academics-sections",
      draftFilters.departmentId,
      draftFilters.semesterId,
      draftFilters.courseId,
      draftFilters.cycle,
    ],
    queryFn: async () => {
      if (
        !draftFilters.departmentId ||
        !draftFilters.semesterId ||
        !draftFilters.courseId
      )
        return [];
      const res = await axios.get<BaseResponse<{ id: string; name: string }[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/academics/reports/sections`,
        {
          params: {
            departmentId: draftFilters.departmentId,
            semesterId: draftFilters.semesterId,
            courseId: draftFilters.courseId,
            ...(isSemesterOneOrTwo && draftFilters.cycle
              ? { cycle: draftFilters.cycle }
              : {}),
          },
          withCredentials: true,
        }
      );
      if (res.data.status === "success") return res.data.data ?? [];
      return [];
    },
    enabled:
      !!draftFilters.departmentId &&
      !!draftFilters.semesterId &&
      !!draftFilters.courseId,
  });
  const sections = Array.isArray(rawSections) ? rawSections : [];

  const isApplyReady =
    !!draftFilters.termId &&
    !!draftFilters.semesterId &&
    !!draftFilters.departmentId &&
    !!draftFilters.courseId &&
    !!draftFilters.sectionId &&
    (!isSemesterOneOrTwo || !!draftFilters.cycle);

  const applyFilters = () => {
    if (!isApplyReady) return;
    const nextFilters = {
      ...draftFilters,
      cycle: isSemesterOneOrTwo
        ? draftFilters.cycle || BASIC_SCIENCES_CYCLE_OPTIONS[0]
        : "",
    };
    setAppliedFilters(nextFilters);
    const query = createFilterQueryString(nextFilters);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };

  const resetFilters = () => {
    const defaultFilters = {
      ...EMPTY_FILTERS,
      departmentId: fixedDepartmentId ?? "",
      departmentName: fixedDepartmentName ?? "",
    };
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    router.replace(pathname, { scroll: false });
  };

  const hasAppliedFilters =
    !!appliedFilters.termId &&
    !!appliedFilters.departmentId &&
    !!appliedFilters.semesterId &&
    !!appliedFilters.courseId &&
    !!appliedFilters.sectionId;

  // 1) Status Tab
  const {
    data: statusReportDataRaw,
    isLoading: isLoadingStatus,
    isError: isErrorSessions,
    error: errorSessions,
  } = useQuery({
    queryKey: [
      "admin-attendance-status",
      appliedFilters.courseId,
      appliedFilters.sectionId,
    ],
    queryFn: async () => {
      if (!hasAppliedFilters) return null;
      const res = await axios.get(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/academics/reports/attendance/status`,
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
    enabled: hasAppliedFilters && activeTab === "status",
  });
  const statusReportData = Array.isArray(statusReportDataRaw)
    ? statusReportDataRaw
    : [];

  // 2) Detailed & Percentage Tabs
  const { data: detailedReportDataRaw, isLoading: isLoadingDetailed } =
    useQuery({
      queryKey: [
        "admin-attendance-detailed",
        appliedFilters.courseId,
        appliedFilters.sectionId,
      ],
      queryFn: async () => {
        if (!hasAppliedFilters) return null;
        const res = await axios.get<BaseResponse<DetailedReportData>>(
          `${NEXT_PUBLIC_API_BASE_URL}/admin/academics/reports/attendance/detailed`,
          {
            params: {
              courseId: appliedFilters.courseId,
              sectionId: appliedFilters.sectionId,
            },
            withCredentials: true,
          }
        );
        return res.data.status === "success" ? res.data.data : null;
      },
      enabled:
        hasAppliedFilters &&
        (activeTab === "detailed" || activeTab === "percentage"),
    });

  const detailedReportData = detailedReportDataRaw ?? undefined;

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

  const getHeaderMetadata = useCallback(() => {
    const term =
      terms.find((t) => t.id === appliedFilters.termId)?.year || "N/A";
    const dept = appliedFilters.departmentName || "N/A";
    const sem =
      semesterOptions.find((s) => s.id === appliedFilters.semesterId)
        ?.semesterNumber || "N/A";
    const course =
      courses.find((c) => c.id === appliedFilters.courseId)?.name || "N/A";
    const section =
      sections.find((s) => s.id === appliedFilters.sectionId)?.name || "N/A";

    return [
      `Academic Term: ${term}`,
      `Department: ${dept}`,
      `Semester: ${sem}`,
      `Course: ${course}`,
      `Section: ${section}`,
    ];
  }, [terms, appliedFilters, semesterOptions, courses, sections]);

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

    const csvRows = [
      ["Attendance Detailed Report"],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      ...metadata.map((m) => [m]),
      [],
      headers,
      ...rows,
    ];

    downloadCSV("attendance-detailed-report.csv", csvRows);
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

  const filterFields: FilterFieldConfig<AdminAttendanceReportFiltersState>[] = [
    {
      key: "termId" as const,
      label: "Academic Term",
      type: "select" as const,
      options: terms.map((term) => ({
        label: `${term.type.toUpperCase()} ${term.year}`,
        value: term.id,
      })),
      hideAllOption: true,
    },
    ...(fixedDepartmentId
      ? []
      : [
          {
            key: "departmentName" as const,
            label: "Department",
            type: "select" as const,
            options: departments.map((d) => ({
              label: d.name,
              value: d.name,
            })),
            hideAllOption: true,
          },
        ]),
    {
      key: "semesterId" as const,
      label: "Semester",
      type: "select" as const,
      options: semesterOptions.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: semester.id,
      })),
      placeholder:
        draftFilters.termId && draftFilters.departmentName
          ? "Select semester..."
          : "Select term and department first",
      hideAllOption: true,
    },
    ...(isSemesterOneOrTwo
      ? [
          {
            key: "cycle" as const,
            label: "Cycle",
            type: "select" as const,
            options: BASIC_SCIENCES_CYCLE_OPTIONS.map((cycle) => ({
              label: cycle,
              value: cycle,
            })),
            hideAllOption: true,
          } as FilterFieldConfig<AdminAttendanceReportFiltersState>,
        ]
      : []),
    {
      key: "courseId" as const,
      label: "Course",
      type: "select" as const,
      placeholder: loadingCourses ? "Loading courses..." : "Select a course",
      options: courses.map((course) => ({
        label: `${course.code} - ${course.name}`,
        value: course.id,
      })),
      hideAllOption: true,
    },
    {
      key: "sectionId" as const,
      label: "Section",
      type: "select" as const,
      placeholder: loadingSections ? "Loading sections..." : "Select a section",
      options: sections.map((sec) => ({
        label: sec.name,
        value: sec.id,
      })),
      hideAllOption: true,
    },
  ];

  return (
    <div className="space-y-8 p-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Attendance Report
        </h1>
        <p className="text-muted-foreground text-sm">
          View attendance status, detailed records, and eligibility percentages.
        </p>
      </header>

      <FilterPanel>
        <FilterBuilder
          fields={filterFields}
          draftFilters={draftFilters}
          onDraftChange={(key, value) => {
            setDraftFilters((current) => {
              const next = { ...current, [key]: value };
              if (key === "termId") {
                next.departmentName = "";
                next.departmentId = "";
                next.semesterId = "";
                next.cycle = "";
                next.courseId = "";
                next.sectionId = "";
              } else if (key === "departmentName") {
                const selected = departments.find((d) => d.name === value);
                next.departmentId = selected?.id ?? "";
                next.semesterId = "";
                next.cycle = "";
                next.courseId = "";
                next.sectionId = "";
              } else if (key === "semesterId") {
                next.cycle = "";
                next.courseId = "";
                next.sectionId = "";
              } else if (key === "cycle") {
                next.courseId = "";
                next.sectionId = "";
              } else if (key === "courseId") {
                next.sectionId = "";
              }
              return next;
            });
          }}
        />
        <div className="mt-4 flex justify-end">
          <FilterActions
            onApply={applyFilters}
            onReset={resetFilters}
            isApplyDisabled={!isApplyReady}
            applyLabel="Get Report"
          />
        </div>
      </FilterPanel>

      {hasAppliedFilters && (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="w-full"
        >
          <div className="mb-4 flex flex-col items-center justify-between gap-4 md:flex-row">
            <TabsList>
              <TabsTrigger value="status">Status Report</TabsTrigger>
              <TabsTrigger value="detailed">Detailed Report</TabsTrigger>
              <TabsTrigger value="percentage">Percentage View</TabsTrigger>
            </TabsList>

            {activeTab === "percentage" && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="percentageFrom">From (%)</Label>
                  <Input
                    id="percentageFrom"
                    type="number"
                    min={0}
                    max={100}
                    className="w-20"
                    placeholder="0"
                    value={percentageFrom ?? ""}
                    onChange={(e) => setPercentageFrom(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="percentageTo">To (%)</Label>
                  <Input
                    id="percentageTo"
                    type="number"
                    min={0}
                    max={100}
                    className="w-20"
                    placeholder="100"
                    value={percentageTo ?? ""}
                    onChange={(e) => setPercentageTo(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-card text-card-foreground rounded-xl border p-4 shadow-sm">
            {activeTab === "status" && (
              <AttendanceStatusTable
                statusReportData={statusReportData}
                isErrorSessions={isErrorSessions}
                errorSessions={errorSessions}
                onSessionSelect={() => {}}
                emptyMessage={
                  isLoadingStatus
                    ? "Loading..."
                    : "No status data found for selected filters."
                }
              />
            )}

            {activeTab === "detailed" && (
              <AttendanceDetailedTable
                detailedReportData={detailedReportData ?? undefined}
                isLoadingDetailed={isLoadingDetailed}
                emptyMessage="No detailed data found for selected filters."
                onDownloadDetailedPDF={handleDownloadPDF}
                onDownloadDetailedExcel={handleDownloadExcel}
              />
            )}

            {activeTab === "percentage" && (
              <AttendancePercentageTable
                percentageReportData={percentageReportData ?? undefined}
                emptyMessage="No percentage data found for selected filters."
                onDownloadPercentagePDF={handleDownloadPercentagePDF}
                onDownloadPercentageExcel={handleDownloadPercentageExcel}
              />
            )}
          </div>
        </Tabs>
      )}
    </div>
  );
};
