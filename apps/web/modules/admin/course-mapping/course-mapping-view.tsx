"use client";

import { AuditHistoryDialog } from "@/components/admin/audit-history-dialog";
import { apiClient } from "@/lib/api-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import {
  CourseMappingStatusItemType,
  CourseResponseDTO,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { Download, ShieldCheck, Upload } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { CourseDetailsCard } from "../../department/course-mapping/course-details-card";
import { AdminCourseMappingGrid } from "./course-mapping-grid";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const BASIC_SCIENCES_CYCLE_OPTIONS = ["PHYSICS", "CHEMISTRY"] as const;

export type AdminCourseMappingFiltersState = {
  departmentId: string;
  departmentName: string;
  termId: string;
  semesterId: string;
  cycle: string;
  courseId: string;
};

const EMPTY_FILTERS: AdminCourseMappingFiltersState = {
  departmentId: "",
  departmentName: "",
  termId: "",
  semesterId: "",
  cycle: "",
  courseId: "",
};

type ExtractedExcelRow = {
  section: string;
  facultyName: string;
};

export const AdminCourseMappingView = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [draftFilters, setDraftFilters] =
    useState<AdminCourseMappingFiltersState>(() =>
      getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
    );
  const [appliedFilters, setAppliedFilters] =
    useState<AdminCourseMappingFiltersState>(() =>
      getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
    );

  useEffect(() => {
    const nextFilters = getFiltersFromSearchParams(searchParams, EMPTY_FILTERS);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams]);

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

  const isApplyReady =
    !!draftFilters.termId &&
    !!draftFilters.semesterId &&
    !!draftFilters.departmentId &&
    !!draftFilters.courseId &&
    (!isSemesterOneOrTwo || !!draftFilters.cycle);

  const selectedAppliedTerm = terms.find(
    (term) => term.id === appliedFilters.termId
  );
  const academicYear = selectedAppliedTerm?.year ?? "";

  const selectedAppliedDepartment = departments.find(
    (d) => d.id === appliedFilters.departmentId
  );
  const isBasicSciences = selectedAppliedDepartment?.type === "BASIC_SCIENCES";

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
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    router.replace(pathname, { scroll: false });
  };

  const { data: rawCourses, isLoading: loadingCourses } = useQuery({
    queryKey: [
      "admin-course-mapping-status",
      draftFilters.departmentId,
      draftFilters.semesterId,
      selectedDraftTerm?.year,
      draftFilters.cycle,
    ],
    queryFn: async () => {
      if (
        !draftFilters.departmentId ||
        !draftFilters.semesterId ||
        !selectedDraftTerm?.year
      ) {
        return [];
      }

      const res = await apiClient.get<
        BaseResponse<{ courses: CourseMappingStatusItemType[] }>
      >(`/admin/course-assignment/status`, {
        params: {
          departmentId: draftFilters.departmentId,
          departmentName: draftFilters.departmentName,
          semesterId: draftFilters.semesterId,
          academicYear: selectedDraftTerm.year,
          ...(isSemesterOneOrTwo && draftFilters.cycle
            ? { cycle: draftFilters.cycle }
            : {}),
        },
      });

      if (res.data.status === "success" && res.data.data?.courses) {
        return res.data.data.courses;
      }
      return [];
    },
    enabled:
      !!draftFilters.departmentId &&
      !!draftFilters.semesterId &&
      !!selectedDraftTerm?.year,
  });

  const courses = rawCourses ?? [];

  const filterFields: FilterFieldConfig<AdminCourseMappingFiltersState>[] = [
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      options: terms.map((term) => ({
        label: `${term.type.toUpperCase()} ${term.year}`,
        value: term.id,
      })),
      hideAllOption: true,
    },
    {
      key: "departmentName",
      label: "Department",
      type: "select",
      options: departments.map((department) => ({
        label: department.name,
        value: department.name,
      })),
      placeholder: draftFilters.termId
        ? "Select department..."
        : "Select term first",
      hideAllOption: true,
    },
    {
      key: "semesterId",
      label: "Semester",
      type: "select",
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
            key: "cycle",
            label: "Cycle",
            type: "select",
            options: BASIC_SCIENCES_CYCLE_OPTIONS.map((cycle) => ({
              label: cycle,
              value: cycle,
            })),
            hideAllOption: true,
          } as FilterFieldConfig<AdminCourseMappingFiltersState>,
        ]
      : []),
    {
      key: "courseId",
      label: "Course",
      type: "select",
      placeholder: loadingCourses ? "Loading courses..." : "Select a course",
      options: courses.map((course) => ({
        label: `${course.code} - ${course.name} [${course.status}]`,
        value: course.courseId,
      })),
      hideAllOption: true,
    },
  ];

  const { data: selectedCourse } = useQuery({
    queryKey: [
      "admin-course-details",
      appliedFilters.courseId,
      appliedFilters.departmentId,
      appliedFilters.departmentName,
    ],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<CourseResponseDTO>>(
        `/admin/course/${appliedFilters.courseId}`,
        {
          params: {
            departmentId: appliedFilters.departmentId,
            departmentName: appliedFilters.departmentName,
          },
        }
      );
      if (res.data.status === "success") {
        return res.data.data;
      }
      return null;
    },
    enabled: !!appliedFilters.courseId && !!appliedFilters.departmentId,
  });

  const isCourseLocked =
    selectedCourse?.approvalStatus === "PENDING" ||
    selectedCourse?.approvalStatus === "APPROVED";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [extractedExcelData, setExtractedExcelData] = useState<
    ExtractedExcelRow[] | null
  >(null);

  const handleDownloadTemplate = async () => {
    if (!selectedCourse || !appliedFilters.semesterId) return;
    try {
      setIsProcessingExcel(true);
      const res = await apiClient.get(
        `/admin/course-assignment/excel/template`,
        {
          params: {
            courseId: selectedCourse.id,
            semesterId: appliedFilters.semesterId,
            academicYear,
            departmentId: appliedFilters.departmentId,
          },
          responseType: "blob",
        }
      );

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${selectedCourse.code}_mapping_template.xlsx`
      );
      document.body.appendChild(link);

      link.click();
      link.remove();
    } catch (error: unknown) {
      console.error(error);
      toast.error("Failed to download template");
    } finally {
      setIsProcessingExcel(false);
    }
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !appliedFilters.departmentId) return;

    try {
      setIsProcessingExcel(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("departmentId", appliedFilters.departmentId);

      const res = await apiClient.post(
        `/admin/course-assignment/excel/upload`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const extractedData = res.data.data?.extractedData as
        | ExtractedExcelRow[]
        | undefined;

      if (extractedData && extractedData.length > 0) {
        setExtractedExcelData(extractedData);
        toast.success("Excel data populated! Please review before saving.");
      } else {
        toast.warning("No mapping data found in the uploaded file.");
      }
    } catch (error: unknown) {
      console.error(error);
      toast.error("Failed to parse Excel file");
    } finally {
      setIsProcessingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-8">
      {isCourseLocked && (
        <div className="border-primary/20 bg-primary/10 text-primary flex items-start gap-3 rounded-lg border p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5" />
          <div className="flex flex-col gap-1">
            <h5 className="font-medium leading-none tracking-tight">
              Admin Override Enabled
            </h5>
            <div className="text-sm">
              This course is {selectedCourse?.approvalStatus?.toLowerCase()}.
              You have override privileges to modify faculty assignments.
            </div>
          </div>
        </div>
      )}

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
              } else if (key === "departmentName") {
                const selected = departments.find((d) => d.name === value);
                next.departmentId = selected?.id ?? "";
                next.semesterId = "";
                next.cycle = "";
                next.courseId = "";
              } else if (key === "semesterId") {
                next.cycle = "";
                next.courseId = "";
              } else if (key === "cycle") {
                next.courseId = "";
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
            applyLabel="Start Mapping"
          />
        </div>
      </FilterPanel>

      {selectedCourse &&
        selectedAppliedDepartment &&
        appliedFilters.semesterId &&
        academicYear && (
          <div className="flex w-full flex-col gap-6">
            <CourseDetailsCard course={selectedCourse}>
              <div className="flex flex-col items-start gap-2 md:items-end">
                <AuditHistoryDialog courseId={selectedCourse.id} />
                {selectedCourse.lastOverrideAt && (
                  <span className="text-muted-foreground text-left text-xs md:text-right">
                    Last override:{" "}
                    {new Date(selectedCourse.lastOverrideAt).toLocaleString()}
                  </span>
                )}
              </div>
            </CourseDetailsCard>

            <div className="bg-card text-card-foreground w-full overflow-hidden rounded-xl border shadow-sm">
              <div className="p-6">
                {/* --- Excel Action Buttons --- */}
                <div className="mb-4 flex flex-row items-center justify-between">
                  <h3 className="text-lg font-semibold">Faculty Assignments</h3>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleDownloadTemplate}
                      disabled={isProcessingExcel}
                    >
                      <Download className="mr-2 h-4 w-4" /> Download Template
                    </Button>

                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".xlsx"
                      onChange={handleUploadExcel}
                    />

                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessingExcel}
                    >
                      <Upload className="mr-2 h-4 w-4" /> Upload Excel
                    </Button>
                  </div>
                </div>
                {/* --- End of Excel Action Buttons --- */}

                <AdminCourseMappingGrid
                  course={selectedCourse}
                  departmentId={selectedAppliedDepartment.id}
                  departmentName={selectedAppliedDepartment.name}
                  semesterId={appliedFilters.semesterId}
                  academicYear={academicYear}
                  cycle={appliedFilters.cycle}
                  isBasicSciences={isBasicSciences}
                  isLocked={isCourseLocked}
                  excelExtractedData={extractedExcelData}
                  onExcelDataConsumed={() => setExtractedExcelData(null)}
                />
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
