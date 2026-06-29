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
import { BookOpen, ClipboardList, GraduationCap, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
// Sheet imports removed as they were not used
import { QPSetupDialog } from "./qp-setup-dialog";
import { useFacultyAcademicTerms } from "./use-faculty-terms";
import { ViewAssessmentDialog } from "./view-assessment-dialog";

interface CoordinatedCourse {
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
  cieMaxMarks: number;
  maxNoOfCies: number;
  assessments?: { id: string; title: string }[];
}

type DashboardFilters = {
  termId: string;
  semesterId: string;
  cycle: string;
};

const EMPTY_FILTERS: DashboardFilters = {
  termId: "",
  semesterId: "",
  cycle: "",
};

export const QuestionPaperDashboard = () => {
  const queryClient = useQueryClient();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters | null>(
    null
  );
  const [cieSheetCourse, setCieSheetCourse] =
    useState<CoordinatedCourse | null>(null);
  const [viewAssessmentId, setViewAssessmentId] = useState<{
    id: string;
    courseName: string;
  } | null>(null);

  // Fetch academic terms
  const { data: rawTerms } = useFacultyAcademicTerms();
  const terms = useMemo(() => rawTerms ?? [], [rawTerms]);

  const selectedDraftTerm = useMemo(
    () => terms.find((t) => t.id === draftFilters.termId),
    [terms, draftFilters.termId]
  );
  const nestedSemesters = useMemo(
    () => selectedDraftTerm?.Semester ?? [],
    [selectedDraftTerm]
  );

  // Auto-select current term
  useEffect(() => {
    if (!draftFilters.termId && terms.length > 0) {
      const currentTerm = terms.find((t) => t.isCurrent) ?? terms[0];
      if (currentTerm) {
        setDraftFilters((cur) => ({ ...cur, termId: currentTerm.id }));
      }
    }
  }, [draftFilters.termId, terms]);

  // Auto-select first semester
  useEffect(() => {
    if (
      draftFilters.termId &&
      !draftFilters.semesterId &&
      nestedSemesters.length > 0
    ) {
      setDraftFilters((cur) => ({
        ...cur,
        semesterId: nestedSemesters[0]!.id,
      }));
    }
  }, [draftFilters.semesterId, draftFilters.termId, nestedSemesters]);

  // Fetch coordinated courses
  const { data: rawCourses, isLoading: loadingCourses } = useQuery({
    queryKey: [
      "coordinated-courses",
      appliedFilters?.semesterId,
      appliedFilters?.cycle,
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (appliedFilters?.semesterId) {
        params.semesterId = appliedFilters.semesterId;
      }
      if (appliedFilters?.cycle) {
        params.cycle = appliedFilters.cycle;
      }

      const res = await axios.get<BaseResponse<CoordinatedCourse[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/assessment/coordinated-courses`,
        { params, withCredentials: true }
      );
      return res.data.status === "success" && res.data.data
        ? res.data.data
        : [];
    },
    enabled: !!appliedFilters?.semesterId,
  });

  const courses = rawCourses ?? [];

  const applyFilters = () => {
    if (!draftFilters.termId || !draftFilters.semesterId) return;
    setAppliedFilters({ ...draftFilters });
  };

  const resetFilters = () => {
    setDraftFilters({
      ...EMPTY_FILTERS,
      termId: draftFilters.termId,
    });
    setAppliedFilters(null);
  };

  const filterFields: FilterFieldConfig<typeof EMPTY_FILTERS>[] = [
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      hideAllOption: true,
      options: terms.map((t) => ({
        label: `${t.type.charAt(0).toUpperCase() + t.type.slice(1)} ${t.year}`,
        value: t.id,
      })),
    },
    {
      key: "semesterId",
      label: "Semester",
      type: "select",
      hideAllOption: true,
      options: nestedSemesters.map((s) => ({
        label: `${s.programType} - Semester ${s.semesterNumber}`,
        value: s.id,
      })),
    },
  ];

  // Conditional Cycle filter if UG Semester 1 or 2
  const selectedSemester = nestedSemesters.find(
    (s) => s.id === draftFilters.semesterId
  );
  if (
    selectedSemester?.programType === "UG" &&
    (selectedSemester.semesterNumber === 1 ||
      selectedSemester.semesterNumber === 2)
  ) {
    filterFields.push({
      key: "cycle",
      label: "Cycle",
      type: "select",
      hideAllOption: true,
      options: [
        { label: "Physics", value: "PHYSICS" },
        { label: "Chemistry", value: "CHEMISTRY" },
      ],
    });
  }

  const creditString = (c: CoordinatedCourse) =>
    `${c.lectureCredits}-${c.tutorialCredits}-${c.practicalCredits}-${c.skillCredits}`;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <ClipboardList className="text-primary size-7" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Question Paper Setup
          </h1>
          <p className="text-muted-foreground text-sm">
            Courses you have been appointed to coordinate. Set up CIE question
            papers and assessment templates.
          </p>
        </div>
      </div>

      <FilterPanel>
        <FilterBuilder
          fields={filterFields}
          draftFilters={draftFilters}
          onDraftChange={(key, value) => {
            setDraftFilters((cur) => {
              const next = { ...cur, [key]: value };
              if (key === "termId") {
                next.semesterId = "";
                next.cycle = "";
              }
              if (key === "semesterId") {
                next.cycle = "";
              }
              return next;
            });
          }}
          className="md:grid-cols-2"
        />
        <div className="mt-4 flex justify-end">
          <FilterActions
            onApply={applyFilters}
            onReset={resetFilters}
            applyLabel="View Courses"
          />
        </div>
      </FilterPanel>

      {appliedFilters && (
        <div className="space-y-4">
          {loadingCourses ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="text-muted-foreground size-8 animate-spin" />
            </div>
          ) : courses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 p-12">
                <GraduationCap className="text-muted-foreground size-12 opacity-40" />
                <p className="text-muted-foreground text-sm">
                  You are not appointed as a coordinator for any courses in this
                  semester.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {courses.map((course) => (
                <Card
                  key={course.id}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
                          <BookOpen className="text-primary size-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {course.code} — {course.name}
                          </CardTitle>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {course.departmentName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {course.assessments?.map((assessment) => (
                          <Button
                            key={assessment.id}
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setViewAssessmentId({
                                id: assessment.id,
                                courseName: `${course.code} — ${course.name}`,
                              })
                            }
                          >
                            {assessment.title}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant={
                            course.assessments?.length ? "secondary" : "default"
                          }
                          onClick={() => setCieSheetCourse(course)}
                        >
                          {course.assessments?.length
                            ? "+ New Assessment"
                            : "Setup CIE"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{course.courseMode}</Badge>
                      <Badge variant="outline">{course.courseType}</Badge>
                      <Badge variant="outline">
                        Credits: {creditString(course)} = {course.totalCredits}
                      </Badge>
                      <Badge variant="outline">
                        {course.programType} Sem {course.semesterNumber}
                      </Badge>
                      <Badge variant="outline">
                        CIE: {course.maxNoOfCies} × {course.cieMaxMarks} marks
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {cieSheetCourse && (
        <QPSetupDialog
          open={!!cieSheetCourse}
          onOpenChange={(open: boolean) => {
            if (!open) setCieSheetCourse(null);
          }}
          course={cieSheetCourse}
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
