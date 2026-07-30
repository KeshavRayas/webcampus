"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
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
  cieCount: number;
  cieMaxMarks: number;
  cieEligibility: number;
  theoryMaxMarks: number;
  theoryMinExams: number;
  theoryEligibility: number;
  labCount: number;
  labMaxMarks: number;
  labEligibility: number;
  aatMaxMarks: number;
  aatEligibility: number;

  assessments?: { id: string; title: string; totalMarks: number }[];
}

export type SetupContext = {
  course: CoordinatedCourse;
  assessmentTitle: string;
  maxMarks: number;
};

// Define the exact shape of our filters for the generic component
type DashboardFilters = {
  termId: string;
  semesterId: string;
  cycle: string;
};

export const QuestionPaperDashboard = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const [setupContext, setSetupContext] = useState<SetupContext | null>(null);
  const [viewAssessmentId, setViewAssessmentId] = useState<{
    id: string;
    courseName: string;
  } | null>(null);

  const { data: terms, isLoading: termsLoading } = useFacultyAcademicTerms();

  const [draftFilters, setDraftFilters] = useState<DashboardFilters>({
    termId: "",
    semesterId: "",
    cycle: "",
  });

  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>({
    termId: "",
    semesterId: "",
    cycle: "",
  });

  const selectedTermSemesters = useMemo(() => {
    if (!terms || !draftFilters.termId) return [];
    const term = terms.find((t) => t.id === draftFilters.termId);
    return term?.Semester || [];
  }, [terms, draftFilters.termId]);

  useEffect(() => {
    if (terms?.length && !draftFilters.termId) {
      const currentTerm = terms.find((t) => t.isCurrent) || terms[0];
      // Fixed: Safety check for undefined
      if (currentTerm) {
        setDraftFilters((prev) => ({ ...prev, termId: currentTerm.id }));
      }
    }
  }, [terms, draftFilters.termId]);

  // Fixed: Passed generic DashboardFilters and changed 'id' to 'key'
  const filterFields: FilterFieldConfig<DashboardFilters>[] = [
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      options:
        terms?.map((t) => ({
          label: `${t.type} ${t.year}`,
          value: t.id,
        })) || [],
      placeholder: termsLoading ? "Loading terms..." : "Select Term",
    },
    {
      key: "semesterId",
      label: "Semester",
      type: "select",
      options: selectedTermSemesters.map((s) => ({
        label: `Semester ${s.semesterNumber}`,
        value: s.id,
      })),
      placeholder: draftFilters.termId
        ? "Select Semester"
        : "Select Term First",
    },
    {
      key: "cycle",
      label: "Cycle",
      type: "select",
      options: [
        { label: "Physics", value: "PHYSICS" },
        { label: "Chemistry", value: "CHEMISTRY" },
        { label: "None", value: "NONE" },
      ],
      placeholder: "Select Cycle (Optional)",
    },
  ];

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
  };

  const handleResetFilters = () => {
    const resetState = { termId: draftFilters.termId, semesterId: "", cycle: "" };
    setDraftFilters(resetState);
    setAppliedFilters(resetState);
  };

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: [
      "coordinated-courses",
      appliedFilters.semesterId,
      appliedFilters.cycle,
    ],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<CoordinatedCourse[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/assessment/coordinated-courses`,
        {
          params: {
            semesterId: appliedFilters.semesterId,
            cycle: appliedFilters.cycle,
          },
          withCredentials: true,
        }
      );
      // Fixed: TypeScript Union check for BaseResponse
      if (res.data.status === "success" && "data" in res.data) {
        return res.data.data;
      }
      return [];
    },
    enabled: !!appliedFilters.semesterId,
  });

  const creditString = (course: CoordinatedCourse) =>
    `${course.lectureCredits}-${course.tutorialCredits}-${course.practicalCredits}-${course.skillCredits}`;

  const renderAssessmentButton = (course: CoordinatedCourse, title: string, maxMarks: number) => {
    const existing = course.assessments?.find((a) => a.title === title);

    if (existing) {
      return (
        <Button
          key={title}
          variant="outline"
          size="sm"
          onClick={() =>
            setViewAssessmentId({ id: existing.id, courseName: course.name })
          }
        >
          <ClipboardList className="mr-2 h-4 w-4" /> View {title}
        </Button>
      );
    }

    return (
      <Button
        key={title}
        size="sm"
        onClick={() => setSetupContext({ course, assessmentTitle: title, maxMarks })}
      >
        <PlusCircle className="mr-2 h-4 w-4" /> Setup {title}
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
              }));
              return;
            }
            setDraftFilters((prev) => ({ ...prev, [key]: value }));
          }}
          className="md:grid-cols-3"
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
              {/* Fixed: Explicit typing applied to course */}
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
                        {Array.from({ length: course.cieCount || 0 }).map((_, i) =>
                          renderAssessmentButton(course, `CIE ${i + 1}`, course.cieMaxMarks)
                        )}
                        {Array.from({ length: course.labCount || 0 }).map((_, i) =>
                          renderAssessmentButton(course, `Lab ${i + 1}`, course.labMaxMarks)
                        )}
                        {Array.from({ length: course.theoryMinExams || 0 }).map((_, i) =>
                          renderAssessmentButton(course, `Theory Exam ${i + 1}`, course.theoryMaxMarks)
                        )}
                        {(course.aatMaxMarks || 0) > 0 &&
                          renderAssessmentButton(course, `AAT`, course.aatMaxMarks)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
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