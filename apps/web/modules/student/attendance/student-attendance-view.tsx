"use client";

import { useQuery } from "@tanstack/react-query";
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
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useStudentTerms } from "./use-student-terms";

interface CourseAttendanceSummary {
  courseId: string;
  courseCode: string;
  courseName: string;
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
  condonationApproved: boolean;
}

interface SessionDetail {
  sessionId: string;
  sessionDate: string;
  topic: string;
  status: "PRESENT" | "ABSENT" | "LATE";
}

type AttendanceFilters = {
  termId: string;
  semesterId: string;
};

export const StudentAttendanceView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const { data: terms, isLoading: termsLoading } = useStudentTerms();

  const [draftFilters, setDraftFilters] = useState<AttendanceFilters>({
    termId: "",
    semesterId: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<AttendanceFilters>({
    termId: "",
    semesterId: "",
  });

  const [selectedCourse, setSelectedCourse] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const selectedTermSemesters = useMemo(() => {
    if (!terms || !draftFilters.termId) return [];
    const term = terms.find((t) => t.id === draftFilters.termId);
    return term?.Semester || [];
  }, [terms, draftFilters.termId]);

  useEffect(() => {
    if (terms?.length && !draftFilters.termId) {
      const currentTerm = terms.find((t) => t.isCurrent) || terms[0];
      if (currentTerm) {
        setDraftFilters((prev) => ({ ...prev, termId: currentTerm.id }));
      }
    }
  }, [terms, draftFilters.termId]);

  const filterFields: FilterFieldConfig<AttendanceFilters>[] = [
    {
      key: "termId",
      label: "Academic Term",
      type: "select",
      options:
        terms?.map((t) => ({ label: `${t.type} ${t.year}`, value: t.id })) ||
        [],
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
  ];

  const handleApply = () => setAppliedFilters(draftFilters);
  const handleReset = () => {
    const reset = { termId: draftFilters.termId, semesterId: "" };
    setDraftFilters(reset);
    setAppliedFilters(reset);
  };

  // Fetch Summary Cards
  const { data: summaries, isLoading: summaryLoading } = useQuery({
    queryKey: ["student-attendance-summary", appliedFilters.semesterId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<CourseAttendanceSummary[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/student/attendance/summary`,
        {
          params: { semesterId: appliedFilters.semesterId },
          withCredentials: true,
        }
      );
      return res.data.status === "success" ? res.data.data : [];
    },
    enabled: !!appliedFilters.semesterId,
  });

  // Fetch Detailed Sessions when a course is clicked
  const { data: details, isLoading: detailsLoading } = useQuery({
    queryKey: ["student-course-attendance-details", selectedCourse?.id],
    queryFn: async () => {
      const res = await axios.get<
        BaseResponse<{
          course: { code: string; name: string };
          sessions: SessionDetail[];
        }>
      >(
        `${NEXT_PUBLIC_API_BASE_URL}/student/attendance/course/${selectedCourse?.id}`,
        { withCredentials: true }
      );
      return res.data.status === "success" ? res.data.data : null;
    },
    enabled: !!selectedCourse?.id,
  });

  if (selectedCourse) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedCourse(null)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Courses
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {selectedCourse.name} - Attendance Details
            </h1>
            <p className="text-muted-foreground">Class-wise session records.</p>
          </div>
        </div>

        {detailsLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : !details?.sessions.length ? (
          <div className="text-muted-foreground rounded-lg border p-8 text-center">
            No attendance sessions recorded yet for this course.
          </div>
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b text-left font-medium">
                  <th className="p-3">Date</th>
                  <th className="p-3">Topic / Session</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {details.sessions.map((s) => (
                  <tr key={s.sessionId} className="border-b">
                    <td className="flex items-center gap-2 p-3">
                      <Calendar className="text-muted-foreground h-4 w-4" />
                      {new Date(s.sessionDate).toLocaleDateString()}
                    </td>
                    <td className="p-3 font-medium">{s.topic}</td>
                    <td className="p-3">
                      <Badge
                        variant={
                          s.status === "PRESENT" ? "default" : "destructive"
                        }
                      >
                        {s.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">View Attendance</h1>
        <p className="text-muted-foreground">
          Track your academic attendance course-wise across semesters.
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
          ) : !summaries?.length ? (
            <div className="bg-muted/20 rounded-lg border p-8 text-center">
              No registered courses found for this semester.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {summaries.map((item) => (
                <Card
                  key={item.courseId}
                  className="cursor-pointer transition-all hover:shadow-md"
                  onClick={() =>
                    setSelectedCourse({
                      id: item.courseId,
                      name: item.courseName,
                    })
                  }
                >
                  <CardHeader className="bg-muted/10 border-b pb-3">
                    <CardTitle className="flex items-start justify-between text-lg">
                      <span className="truncate pr-2" title={item.courseName}>
                        {item.courseName}
                      </span>
                      <span className="text-primary bg-primary/10 shrink-0 rounded px-2 py-1 font-mono text-sm">
                        {item.courseCode}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">
                        Overall Attendance
                      </span>
                      <span
                        className={`text-2xl font-bold ${item.percentage >= 75 ? "text-green-600" : "text-amber-600"}`}
                      >
                        {item.percentage}%
                      </span>
                    </div>

                    <div className="text-muted-foreground flex justify-between border-t pt-3 text-xs">
                      <span>
                        Attended: {item.attendedClasses} / {item.totalClasses}{" "}
                        classes
                      </span>
                      {item.condonationApproved && (
                        <Badge
                          variant="secondary"
                          className="bg-blue-500/10 text-blue-600"
                        >
                          Condonation Approved
                        </Badge>
                      )}
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
