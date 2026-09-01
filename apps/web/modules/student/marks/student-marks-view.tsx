"use client";

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
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useStudentTerms } from "../attendance/use-student-terms";
import { StudentCourseMarks, useStudentMarks } from "./use-student-marks";

type MarksFilters = {
  termId: string;
  semesterId: string;
};

export const StudentMarksView = () => {
  const { data: terms, isLoading: termsLoading } = useStudentTerms();
  const [draftFilters, setDraftFilters] = useState<MarksFilters>({
    termId: "",
    semesterId: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<MarksFilters>({
    termId: "",
    semesterId: "",
  });
  const [selectedCourse, setSelectedCourse] =
    useState<StudentCourseMarks | null>(null);

  const selectedTermSemesters = useMemo(() => {
    if (!terms || !draftFilters.termId) return [];
    const term = terms.find((item) => item.id === draftFilters.termId);
    return term?.Semester || [];
  }, [terms, draftFilters.termId]);

  useEffect(() => {
    if (terms?.length && !draftFilters.termId) {
      const currentTerm = terms.find((term) => term.isCurrent) || terms[0];
      if (currentTerm) {
        setDraftFilters((prev) => ({ ...prev, termId: currentTerm.id }));
      }
    }
  }, [terms, draftFilters.termId]);

  const filterFields: FilterFieldConfig<MarksFilters>[] = [
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      options:
        terms?.map((term) => ({
          label: `${term.type.toUpperCase()} ${term.year}`,
          value: term.id,
        })) || [],
      placeholder: termsLoading ? "Loading terms..." : "Select Term",
    },
    {
      key: "semesterId",
      label: "Semester",
      type: "select",
      options: selectedTermSemesters.map((semester) => ({
        label: `Semester ${semester.semesterNumber}`,
        value: semester.id,
      })),
      placeholder: draftFilters.termId
        ? "Select Semester"
        : "Select Term First",
    },
  ];

  const { data: courses, isLoading: summaryLoading } = useStudentMarks(
    appliedFilters.semesterId
  );

  const handleApply = () => {
    setSelectedCourse(null);
    setAppliedFilters(draftFilters);
  };

  const handleReset = () => {
    const reset = { termId: draftFilters.termId, semesterId: "" };
    setSelectedCourse(null);
    setDraftFilters(reset);
    setAppliedFilters(reset);
  };

  if (selectedCourse) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedCourse(null)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Courses
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {selectedCourse.courseName} - Marks Details
            </h1>
            <p className="text-muted-foreground">
              Assessment-wise marks for {selectedCourse.courseCode}.
            </p>
          </div>
        </div>

        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground border-b text-left font-medium">
                <th className="p-3">Assessment</th>
                <th className="p-3">Score</th>
                <th className="p-3">Max Marks</th>
              </tr>
            </thead>
            <tbody>
              {selectedCourse.assessments.map((assessment) => (
                <tr key={assessment.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{assessment.title}</td>
                  <td className="p-3">{assessment.totalMarks ?? "-"}</td>
                  <td className="p-3">{assessment.maxMarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marks</h1>
        <p className="text-muted-foreground">
          Review your academic marks course-wise across semesters.
        </p>
      </div>

      <FilterPanel>
        <FilterBuilder
          fields={filterFields}
          draftFilters={draftFilters}
          onDraftChange={(key, value) => {
            if (key === "termId") {
              setDraftFilters({ termId: value, semesterId: "" });
              return;
            }
            setDraftFilters((prev) => ({ ...prev, [key]: value }));
          }}
          action={<FilterActions onApply={handleApply} onReset={handleReset} />}
        />
      </FilterPanel>

      {appliedFilters.semesterId && (
        <div className="space-y-6">
          {summaryLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : !courses?.length ? (
            <div className="bg-muted/20 rounded-lg border p-8 text-center">
              No registered courses found for this semester.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <Card
                  key={course.courseId}
                  className="cursor-pointer transition-all hover:shadow-md"
                  onClick={() => setSelectedCourse(course)}
                >
                  <CardHeader className="bg-muted/10 border-b pb-3">
                    <CardTitle className="flex items-start justify-between text-lg">
                      <span className="truncate pr-2" title={course.courseName}>
                        {course.courseName}
                      </span>
                      <span className="text-primary bg-primary/10 shrink-0 rounded px-2 py-1 font-mono text-sm">
                        {course.courseCode}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Theory Exams</p>
                        <p className="font-semibold">
                          {course.components?.theory.obtained ?? "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Lab Exam</p>
                        <p className="font-semibold">
                          {course.components?.lab.obtained ?? "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">AAT</p>
                        <p className="font-semibold">
                          {course.components?.aat.obtained ?? "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-semibold">{course.total ?? "-"}</p>
                      </div>
                    </div>
                    <div className="mt-4 border-t pt-3">
                      <Badge
                        variant={
                          course.status === "ELIGIBLE" ? "default" : "secondary"
                        }
                        className={
                          course.status === "ELIGIBLE"
                            ? "bg-green-600"
                            : "bg-yellow-500 text-black"
                        }
                      >
                        {course.status === "ELIGIBLE"
                          ? "Eligible"
                          : "Not Eligible"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
