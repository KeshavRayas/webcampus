"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  RegistrationWindowCycleSchema,
  type AcademicTermResponseType,
} from "@webcampus/schemas/admin";
import {
  buildAssessmentSlots,
  findAssessmentForSlot,
  type AssessmentSlot,
} from "@webcampus/schemas/faculty";
import { BaseResponse } from "@webcampus/types/api";
import { Badge } from "@webcampus/ui/components/badge";
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
  FilterFieldConfig,
  FilterPanel,
} from "@webcampus/ui/components/filter-builder";
import { capitalize } from "@webcampus/ui/lib/utils";
import axios from "axios";
import { ClipboardList, Loader2, PlusCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { QPSetupDialog } from "./qp-setup-dialog";
import { useFacultyAcademicTerms } from "./use-faculty-terms";
import { ViewAssessmentDialog } from "./view-assessment-dialog";

export interface CoordinatedCourse {
  id: string;
  code: string;
  name: string;
  courseMode: string;
  courseType: string;
  totalCredits: number;
  lectureCredits: number;
  tutorialCredits: number;
  practicalCredits: number;
  skillCredits: number;
  semesterNumber: number;
  semesterId: string;
  programType: string;
  departmentName: string;
  departmentAbbreviation: string;

  // New Configuration Fields
  seeMaxMarks: number;
  seeEligibility: number;
  cieMaxMarks: number;
  cieEligibility: number;
  theoryMaxExams: number;
  theoryExamMaxMarks: number;
  theoryMinExams: number;
  theoryEligibility: number;
  labMaxMarks: number;
  labEligibility: number;
  aatMaxMarks: number;
  aatEligibility: number;

  assessments?: {
    id: string;
    title: string;
    totalMarks: number;
    componentType?: "THEORY" | "LAB" | "AAT" | null;
    sequence?: number | null;
  }[];
}

export type SetupContext = {
  course: CoordinatedCourse;
  assessmentTitle: string;
  maxMarks: number;
  componentType: "THEORY" | "LAB" | "AAT";
  sequence: number;
};

type DashboardFilters = {
  termId: string;
  semesterId: string;
  cycle: string;
};

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);
const TEACHING_CYCLE_OPTIONS = RegistrationWindowCycleSchema.options;

const EMPTY_FILTERS: DashboardFilters = {
  termId: "",
  semesterId: "",
  cycle: "",
};

const formatAcademicTerm = (term: AcademicTermResponseType) =>
  `${capitalize(term.type)} ${term.year}`;

const isFirstYearUgSemester = (semester?: {
  programType: string;
  semesterNumber: number;
}) =>
  semester?.programType === "UG" &&
  FIRST_YEAR_UG_SEMESTERS.has(semester.semesterNumber);

export const QuestionPaperDashboard = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const [setupContext, setSetupContext] = useState<SetupContext | null>(null);
  const [viewAssessmentId, setViewAssessmentId] = useState<{
    id: string;
    courseName: string;
  } | null>(null);

  const { data: terms, isLoading: termsLoading } = useFacultyAcademicTerms();

  const [draftFilters, setDraftFilters] =
    useState<DashboardFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<DashboardFilters>(EMPTY_FILTERS);

  const selectedTermSemesters = useMemo(() => {
    if (!terms || !draftFilters.termId) return [];
    const term = terms.find((t) => t.id === draftFilters.termId);
    return term?.Semester || [];
  }, [terms, draftFilters.termId]);

  const selectedSemester = useMemo(
    () => selectedTermSemesters.find((s) => s.id === draftFilters.semesterId),
    [selectedTermSemesters, draftFilters.semesterId]
  );

  const isFirstYearUg = isFirstYearUgSemester(selectedSemester);

  const appliedTermSemesters = useMemo(() => {
    if (!terms || !appliedFilters.termId) return [];
    const term = terms.find((t) => t.id === appliedFilters.termId);
    return term?.Semester || [];
  }, [terms, appliedFilters.termId]);

  const appliedSemester = useMemo(
    () => appliedTermSemesters.find((s) => s.id === appliedFilters.semesterId),
    [appliedTermSemesters, appliedFilters.semesterId]
  );

  const appliedIsFirstYearUg = isFirstYearUgSemester(appliedSemester);

  const appliedCycle =
    appliedIsFirstYearUg && appliedFilters.cycle ? appliedFilters.cycle : "";

  useEffect(() => {
    if (terms?.length && !draftFilters.termId) {
      const currentTerm = terms.find((t) => t.isCurrent) || terms[0];
      if (currentTerm) {
        setDraftFilters((prev) => ({ ...prev, termId: currentTerm.id }));
      }
    }
  }, [terms, draftFilters.termId]);

  useEffect(() => {
    if (!isFirstYearUg && (draftFilters.cycle || appliedFilters.cycle)) {
      setDraftFilters((prev) => ({ ...prev, cycle: "" }));
      setAppliedFilters((prev) => ({ ...prev, cycle: "" }));
    }
  }, [isFirstYearUg, draftFilters.cycle, appliedFilters.cycle]);

  const filterFields: FilterFieldConfig<DashboardFilters>[] = useMemo(
    () => [
      {
        key: "termId",
        label: "Academic Term",
        type: "select",
        hideAllOption: true,
        options:
          terms?.map((t) => ({
            label: formatAcademicTerm(t),
            value: t.id,
          })) || [],
        placeholder: termsLoading ? "Loading terms..." : "Select term...",
      },
      {
        key: "semesterId",
        label: "Semester",
        type: "select",
        hideAllOption: true,
        options: selectedTermSemesters.map((s) => ({
          label: `${s.programType} - Semester ${s.semesterNumber}`,
          value: s.id,
        })),
        placeholder: draftFilters.termId
          ? "Select semester..."
          : "Select term first",
      },
      ...(isFirstYearUg
        ? [
            {
              key: "cycle",
              label: "Cycle",
              type: "select",
              allOptionLabel: "All cycles",
              placeholder: "All cycles",
              options: TEACHING_CYCLE_OPTIONS.map((cycle) => ({
                label: cycle,
                value: cycle,
              })),
            } as FilterFieldConfig<DashboardFilters>,
          ]
        : []),
    ],
    [
      terms,
      termsLoading,
      selectedTermSemesters,
      draftFilters.termId,
      isFirstYearUg,
    ]
  );

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
  };

  const handleResetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["coordinated-courses", appliedFilters.semesterId, appliedCycle],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<CoordinatedCourse[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/assessment/coordinated-courses`,
        {
          params: {
            semesterId: appliedFilters.semesterId,
            ...(appliedCycle && { cycle: appliedCycle }),
          },
          withCredentials: true,
        }
      );
      if (res.data.status === "success" && "data" in res.data) {
        return res.data.data;
      }
      return [];
    },
    enabled: !!appliedFilters.semesterId,
  });

  const creditString = (course: CoordinatedCourse) =>
    `${course.lectureCredits}-${course.tutorialCredits}-${course.practicalCredits}-${course.skillCredits}`;

  const renderAssessmentButton = (
    course: CoordinatedCourse,
    slot: AssessmentSlot
  ) => {
    const existing = findAssessmentForSlot(course.assessments, slot);

    if (existing) {
      return (
        <Button
          key={slot.title}
          variant="outline"
          size="sm"
          onClick={() =>
            setViewAssessmentId({ id: existing.id, courseName: course.name })
          }
        >
          <ClipboardList className="mr-2 h-4 w-4" /> View {slot.title}
        </Button>
      );
    }

    return (
      <Button
        key={slot.title}
        size="sm"
        onClick={() =>
          setSetupContext({
            course,
            assessmentTitle: slot.title,
            maxMarks: slot.maxMarks,
            componentType: slot.componentType,
            sequence: slot.sequence,
          })
        }
      >
        <PlusCircle className="mr-2 h-4 w-4" /> Setup {slot.title}
      </Button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Question Paper Setup
          </h1>
          <p className="text-muted-foreground">
            Configure assessments for courses where you are a coordinator.
          </p>
        </div>
      </div>

      <FilterPanel>
        <FilterBuilder
          fields={filterFields}
          draftFilters={draftFilters}
          onDraftChange={(key, value) => {
            if (key === "termId") {
              setDraftFilters((current) => ({
                ...current,
                termId: value,
                semesterId: "",
                cycle: "",
              }));
              return;
            }
            if (key === "semesterId") {
              const nextSemester = selectedTermSemesters.find(
                (s) => s.id === value
              );
              setDraftFilters((current) => ({
                ...current,
                semesterId: value,
                cycle: isFirstYearUgSemester(nextSemester) ? current.cycle : "",
              }));
              return;
            }
            setDraftFilters((prev) => ({ ...prev, [key]: value }));
          }}
          className={isFirstYearUg ? "md:grid-cols-3" : "md:grid-cols-2"}
        />
        <FilterActions
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        />
      </FilterPanel>

      {appliedFilters.semesterId && (
        <div className="space-y-6">
          {coursesLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : !courses?.length ? (
            <div className="bg-muted/20 rounded-lg border p-8 text-center">
              No courses assigned as coordinator for this semester.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course: CoordinatedCourse) => (
                <Card key={course.id} className="flex flex-col">
                  <CardHeader className="bg-muted/10 border-b pb-3">
                    <CardTitle className="flex items-start justify-between text-lg">
                      <span className="truncate pr-2" title={course.name}>
                        {course.name}
                      </span>
                      <span className="text-primary bg-primary/10 shrink-0 rounded px-2 py-1 font-mono text-sm">
                        {course.code}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4 pt-4">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">{course.courseMode}</Badge>
                      <Badge variant="outline">{course.courseType}</Badge>
                      <Badge variant="outline">
                        Credits: {creditString(course)} = {course.totalCredits}
                      </Badge>
                    </div>

                    <div className="space-y-3 pt-2">
                      <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider">
                        Assessments Configuration
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {buildAssessmentSlots(course).map((slot) =>
                          renderAssessmentButton(course, slot)
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {setupContext && (
        <QPSetupDialog
          open={!!setupContext}
          onOpenChange={(open: boolean) => {
            if (!open) setSetupContext(null);
          }}
          setupContext={setupContext}
        />
      )}

      {viewAssessmentId && (
        <ViewAssessmentDialog
          open={!!viewAssessmentId}
          onOpenChange={(open: boolean) => {
            if (!open) setViewAssessmentId(null);
          }}
          assessmentId={viewAssessmentId.id}
          courseName={viewAssessmentId.courseName}
          onDelete={() => {
            setViewAssessmentId(null);
            queryClient.invalidateQueries({
              queryKey: ["coordinated-courses"],
            });
          }}
        />
      )}
    </div>
  );
};
