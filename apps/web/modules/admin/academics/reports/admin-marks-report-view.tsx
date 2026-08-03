"use client";

import { MarksReportTable } from "@/components/academics/reports/marks-tables";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import type { MarksReportData } from "@/modules/faculty/marks-report/marks-report-types";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse } from "@webcampus/types/api";
import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

export type AdminMarksReportFiltersState = {
  departmentId: string;
  departmentName: string;
  termId: string;
  semesterId: string;
  cycle: string;
  courseId: string;
  sectionId: string;
};

const EMPTY_FILTERS: AdminMarksReportFiltersState = {
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

export const AdminMarksReportView = ({
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

  const [draftFilters, setDraftFilters] =
    useState<AdminMarksReportFiltersState>(() =>
      getFiltersFromSearchParams(searchParams, {
        ...EMPTY_FILTERS,
        departmentId: fixedDepartmentId ?? "",
        departmentName: fixedDepartmentName ?? "",
      })
    );
  const [appliedFilters, setAppliedFilters] =
    useState<AdminMarksReportFiltersState>(() =>
      getFiltersFromSearchParams(searchParams, {
        ...EMPTY_FILTERS,
        departmentId: fixedDepartmentId ?? "",
        departmentName: fixedDepartmentName ?? "",
      })
    );

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
      return res.data.status === "success" ? (res.data.data ?? []) : [];
    },
    enabled: !!draftFilters.departmentId && !!draftFilters.semesterId,
  });
  const courses = Array.isArray(rawCourses) ? rawCourses : [];

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
      return res.data.status === "success" ? (res.data.data ?? []) : [];
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
    (!isSemesterOneOrTwo || !!draftFilters.cycle); // sectionId is optional for marks report maybe? Let's make it optional

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

  const hasAppliedFilters = !!appliedFilters.courseId;

  const { data: reportData, isLoading } = useQuery({
    queryKey: [
      "admin-marks-detailed",
      appliedFilters.courseId,
      appliedFilters.sectionId,
    ],
    queryFn: async () => {
      if (!hasAppliedFilters) return null;
      const res = await axios.get<BaseResponse<MarksReportData>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/academics/reports/marks/detailed`,
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
    enabled: hasAppliedFilters,
  });

  const getHeaderMetadata = useCallback(() => {
    if (!reportData) return [];
    const dept = appliedFilters.departmentName || "N/A";
    const section =
      sections.find((s) => s.id === appliedFilters.sectionId)?.name ||
      "All Sections";

    return [
      `Department: ${dept}`,
      `Course: ${reportData.course.code} - ${reportData.course.name}`,
      `Semester: ${reportData.semester.semesterNumber}`,
      `Section: ${section}`,
      `Academic Term: ${reportData.semester.academicTerm.type} ${reportData.semester.academicTerm.year}`,
      `Min Required CIE: ${reportData.course.cumulativeMinMarks}`,
    ];
  }, [reportData, appliedFilters, sections]);

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
      reportData.course.cumulativeMinMarks.toString(),
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

  const filterFields: FilterFieldConfig<AdminMarksReportFiltersState>[] = [
    {
      key: "termId" as const,
      label: "Academic Term",
      type: "select" as const,
      options: terms.map((term) => ({
        label: `${term.type.charAt(0).toUpperCase() + term.type.slice(1)}${term.year}`,
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
          } as FilterFieldConfig<AdminMarksReportFiltersState>,
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
      placeholder: loadingSections
        ? "Loading sections..."
        : "Select a section (Optional)",
      options: sections.map((sec) => ({
        label: sec.name,
        value: sec.id,
      })),
      hideAllOption: false, // Optional for marks report
    },
  ];

  return (
    <div className="space-y-8 p-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Marks Report</h1>
        <p className="text-muted-foreground text-sm">
          View consolidated marks report with CIE totals and eligibility status.
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
          className="md:grid-cols-2 xl:grid-cols-5"
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
        <div className="bg-card text-card-foreground rounded-xl border p-4 shadow-sm">
          <MarksReportTable
            reportData={reportData ?? undefined}
            isLoading={isLoading}
            onDownloadPDF={handleDownloadPDF}
            onDownloadExcel={handleDownloadExcel}
            emptyMessage="No marks data found for selected filters."
          />
        </div>
      )}
    </div>
  );
};
