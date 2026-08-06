"use client";

import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { Download, Loader2, Upload } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { EnterMarksDialog } from "../marks-entry/enter-marks-dialog";
import {
  downloadMarksTemplate,
  MarksCourseInfo,
  uploadMarksExcel,
} from "./marks-api";
import { useMarksDashboardAssignments } from "./use-marks-entry";

interface MarksFilters extends Record<string, string> {
  termId: string;
  semesterId: string;
  courseId: string;
  sectionId: string;
}

const EMPTY_FILTERS: MarksFilters = {
  termId: "",
  semesterId: "",
  courseId: "",
  sectionId: "",
};

export const MarksView = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [draftFilters, setDraftFilters] = useState<MarksFilters>(
    () =>
      getFiltersFromSearchParams(searchParams, EMPTY_FILTERS) as MarksFilters
  );
  const [appliedFilters, setAppliedFilters] = useState<MarksFilters>(
    () =>
      getFiltersFromSearchParams(searchParams, EMPTY_FILTERS) as MarksFilters
  );
  const [selectedAssessment, setSelectedAssessment] = useState<{
    courseId: string;
    assessmentId: string;
    assessmentTitle: string;
  } | null>(null);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);

  const { data: assignments, isLoading } = useMarksDashboardAssignments();

  useEffect(() => {
    const nextFilters = getFiltersFromSearchParams(
      searchParams,
      EMPTY_FILTERS
    ) as MarksFilters;
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams]);

  const termOptions = useMemo(() => {
    const options = new Map<string, { value: string; label: string }>();
    (assignments ?? []).forEach((assignment) => {
      const term = assignment.course.semester.academicTerm;
      if (!options.has(term.id)) {
        options.set(term.id, {
          value: term.id,
          label: `${term.type.toUpperCase()} ${term.year}`,
        });
      }
    });

    return Array.from(options.values());
  }, [assignments]);

  const semesterOptions = useMemo(() => {
    const options = new Map<string, { value: string; label: string }>();
    (assignments ?? [])
      .filter((assignment) =>
        draftFilters.termId
          ? assignment.course.semester.academicTerm.id === draftFilters.termId
          : true
      )
      .forEach((assignment) => {
        const semester = assignment.course.semester;
        if (!options.has(semester.id)) {
          options.set(semester.id, {
            value: semester.id,
            label: `Semester ${semester.semesterNumber}`,
          });
        }
      });

    return Array.from(options.values());
  }, [assignments, draftFilters.termId]);

  const sectionOptions = useMemo(() => {
    const options = new Map<string, { value: string; label: string }>();
    (assignments ?? [])
      .filter((assignment) =>
        draftFilters.semesterId
          ? assignment.course.semester.id === draftFilters.semesterId
          : true
      )
      .forEach((assignment) => {
        if (!assignment.section) {
          return;
        }

        if (!options.has(assignment.section.id)) {
          options.set(assignment.section.id, {
            value: assignment.section.id,
            label: assignment.section.name,
          });
        }
      });

    return Array.from(options.values());
  }, [assignments, draftFilters.semesterId]);

  const courseOptions = useMemo(() => {
    const options = new Map<string, { value: string; label: string }>();
    (assignments ?? [])
      .filter((assignment) =>
        draftFilters.termId
          ? assignment.course.semester.academicTerm.id === draftFilters.termId
          : true
      )
      .filter((assignment) =>
        draftFilters.semesterId
          ? assignment.course.semester.id === draftFilters.semesterId
          : true
      )
      .filter((assignment) =>
        draftFilters.sectionId
          ? assignment.section?.id === draftFilters.sectionId
          : true
      )
      .forEach((assignment) => {
        const course = assignment.course;
        if (!options.has(course.id)) {
          options.set(course.id, {
            value: course.id,
            label: `${course.code} - ${course.name}`,
          });
        }
      });

    return Array.from(options.values());
  }, [
    assignments,
    draftFilters.termId,
    draftFilters.semesterId,
    draftFilters.sectionId,
  ]);

  const filteredAssignments = useMemo(() => {
    return (assignments ?? [])
      .filter((assignment) =>
        appliedFilters.termId
          ? assignment.course.semester.academicTerm.id === appliedFilters.termId
          : true
      )
      .filter((assignment) =>
        appliedFilters.semesterId
          ? assignment.course.semester.id === appliedFilters.semesterId
          : true
      )
      .filter((assignment) =>
        appliedFilters.sectionId
          ? assignment.section?.id === appliedFilters.sectionId
          : true
      );
  }, [assignments, appliedFilters]);

  const selectedCourse = useMemo<MarksCourseInfo | null>(() => {
    if (!appliedFilters.courseId) {
      return null;
    }

    const match = filteredAssignments.find(
      (assignment) => assignment.course.id === appliedFilters.courseId
    );
    return match?.course ?? null;
  }, [filteredAssignments, appliedFilters.courseId]);

  const filterFields: FilterFieldConfig<MarksFilters>[] = [
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      options: termOptions,
    },
    {
      key: "semesterId",
      label: "Semester",
      type: "select",
      options: semesterOptions,
    },
    {
      key: "sectionId",
      label: "Section",
      type: "select",
      options: sectionOptions,
    },
    {
      key: "courseId",
      label: "Course",
      type: "select",
      options: courseOptions,
    },
  ];

  const handleDraftChange = (key: keyof MarksFilters, value: string) => {
    setDraftFilters((prev) => {
      const updated: MarksFilters = { ...prev, [key]: value } as MarksFilters;
      if (key === "termId") {
        updated.semesterId = "";
        updated.sectionId = "";
        updated.courseId = "";
      }
      if (key === "semesterId") {
        updated.sectionId = "";
        updated.courseId = "";
      }
      if (key === "sectionId") {
        updated.courseId = "";
      }
      return updated;
    });
  };

  const handleApply = () => {
    setAppliedFilters(draftFilters);
    const queryString = createFilterQueryString(draftFilters);
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  };

  const handleDownloadTemplate = async (
    assessmentId: string,
    assessmentTitle: string
  ) => {
    if (!selectedCourse) return;
    try {
      setIsProcessingExcel(true);
      await downloadMarksTemplate(
        assessmentId,
        appliedFilters.sectionId || undefined,
        selectedCourse.code,
        assessmentTitle
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to download template"
      );
    } finally {
      setIsProcessingExcel(false);
    }
  };

  const handleUploadExcel = async (
    event: React.ChangeEvent<HTMLInputElement>,
    assessmentId: string
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingExcel(true);
      await uploadMarksExcel(
        assessmentId,
        appliedFilters.sectionId || undefined,
        file
      );
      toast.success("Marks uploaded successfully");
      queryClient.invalidateQueries({
        queryKey: ["marks-dashboard-assignments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["assessmentWithMarks", assessmentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["student-marks-summary"],
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload marks"
      );
    } finally {
      setIsProcessingExcel(false);
      const input = document.getElementById(
        `marks-excel-input-${assessmentId}`
      ) as HTMLInputElement | null;
      if (input) input.value = "";
    }
  };

  const handleReset = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSelectedAssessment(null);
    router.replace(pathname, { scroll: false });
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filter Assessments</CardTitle>
        </CardHeader>
        <CardContent>
          <FilterPanel>
            <FilterBuilder
              fields={filterFields}
              draftFilters={draftFilters}
              onDraftChange={handleDraftChange}
              className="md:grid-cols-4"
            />
            <div className="mt-4 flex justify-end">
              <FilterActions onApply={handleApply} onReset={handleReset} />
            </div>
          </FilterPanel>
        </CardContent>
      </Card>

      {selectedCourse && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedCourse.code} - {selectedCourse.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedCourse.assessments.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No assessments created for this course yet.
              </p>
            ) : (
              <div className="grid gap-4">
                {selectedCourse.assessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{assessment.title}</p>
                      <p className="text-muted-foreground text-sm">
                        Total Marks: {assessment.totalMarks}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {assessment.hasMarks ? (
                        <span className="rounded-md bg-green-50 px-2.5 py-1 text-sm font-medium text-green-600">
                          Completed
                        </span>
                      ) : (
                        <span className="rounded-md bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-600">
                          Pending
                        </span>
                      )}
                      <input
                        id={`marks-excel-input-${assessment.id}`}
                        type="file"
                        className="hidden"
                        accept=".xlsx"
                        onChange={(event) =>
                          handleUploadExcel(event, assessment.id)
                        }
                      />
                      <Button
                        variant="outline"
                        disabled={isProcessingExcel}
                        onClick={() =>
                          handleDownloadTemplate(
                            assessment.id,
                            assessment.title
                          )
                        }
                      >
                        <Download className="mr-2 h-4 w-4" /> Download Template
                      </Button>
                      <Button
                        variant="outline"
                        disabled={isProcessingExcel}
                        onClick={() =>
                          document
                            .getElementById(
                              `marks-excel-input-${assessment.id}`
                            )
                            ?.click()
                        }
                      >
                        <Upload className="mr-2 h-4 w-4" /> Upload Excel
                      </Button>
                      <Button
                        onClick={() =>
                          setSelectedAssessment({
                            courseId: selectedCourse.id,
                            assessmentId: assessment.id,
                            assessmentTitle: assessment.title,
                          })
                        }
                        variant="outline"
                      >
                        {assessment.hasMarks ? "Edit Marks" : "Enter Marks"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedAssessment && (
        <EnterMarksDialog
          assessmentId={selectedAssessment.assessmentId}
          courseId={selectedAssessment.courseId}
          assessmentTitle={selectedAssessment.assessmentTitle}
          sectionId={appliedFilters.sectionId || undefined}
          onClose={() => setSelectedAssessment(null)}
          onSuccess={() => setSelectedAssessment(null)}
        />
      )}
    </div>
  );
};
