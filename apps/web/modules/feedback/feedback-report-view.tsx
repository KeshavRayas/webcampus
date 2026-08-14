"use client";

import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useSemestersByTerm } from "@/modules/admin/semester/use-semester-config";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { useState } from "react";
import { toast } from "react-toastify";
import {
  downloadFeedbackCsv,
  getFeedbackFilterOptions,
  getFeedbackReport,
} from "./feedback-api";

type ReportRow = {
  course: { code: string; name: string };
  faculty: { user: { name: string } };
  assignmentType: string;
  section: string;
  batch: string | null;
  roundNumber: number;
  roundName: string;
  responseCount: number;
  questionAverages: number[];
  average: number;
  percentage: number;
};
type Filters = {
  academicTermId: string;
  semesterId: string;
  courseId: string;
  facultyId: string;
  sectionId: string;
  batchId: string;
  feedbackRoundId: string;
  assignmentType: string;
};
type Semester = {
  id: string;
  programType: "UG" | "PG";
  semesterNumber: number;
};
const EMPTY_FILTERS: Filters = {
  academicTermId: "",
  semesterId: "",
  courseId: "",
  facultyId: "",
  sectionId: "",
  batchId: "",
  feedbackRoundId: "",
  assignmentType: "",
};

export function FeedbackReportView({
  role,
  title,
}: {
  role: "faculty" | "hod" | "department" | "coe" | "admin";
  title: string;
}) {
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [hasRunReport, setHasRunReport] = useState(false);
  const { data: loadedTerms } = useAcademicTerms();
  const terms = loadedTerms ?? [];
  const { data: loadedSemesters } = useSemestersByTerm(
    draftFilters.academicTermId
  );
  const semesters = (loadedSemesters ?? []) as Semester[];
  const { data: options } = useQuery({
    queryKey: [
      "feedback-filter-options",
      role,
      draftFilters.academicTermId,
      draftFilters.semesterId,
      draftFilters.courseId,
    ],
    queryFn: () =>
      getFeedbackFilterOptions(role, {
        academicTermId: draftFilters.academicTermId,
        semesterId: draftFilters.semesterId,
        courseId: draftFilters.courseId,
      }),
    enabled: Boolean(draftFilters.academicTermId && draftFilters.semesterId),
  });
  const queryFilters = Object.fromEntries(
    Object.entries(appliedFilters).filter(
      ([, value]) => value.trim().length > 0
    )
  );
  const reportEnabled = hasRunReport && Object.keys(queryFilters).length > 0;
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery<ReportRow[]>({
    queryKey: ["feedback-report", role, queryFilters],
    queryFn: () => getFeedbackReport(queryFilters as never, role),
    enabled: reportEnabled,
  });
  const selectClass =
    "border-input bg-background h-9 rounded-md border px-3 text-sm";
  const canSelectFaculty =
    role === "admin" || role === "hod" || role === "department";
  const rows = data.map((row) => ({
    Faculty: row.faculty.user.name,
    Course: `${row.course.code} - ${row.course.name}`,
    Type: row.assignmentType,
    Section: row.section,
    Batch: row.batch ?? "",
    Round: row.roundName || `Round ${row.roundNumber}`,
    Responses: row.responseCount,
    ...Object.fromEntries(
      row.questionAverages.map((average, index) => [
        `Q${index + 1}`,
        average.toFixed(2),
      ])
    ),
    "Average / 5": row.average.toFixed(2),
    Percentage: `${row.percentage.toFixed(2)}%`,
  }));
  const applyFilters = () => {
    if (!draftFilters.academicTermId || !draftFilters.semesterId) {
      toast.error("Select an academic term and semester");
      return;
    }
    if (
      !draftFilters.courseId &&
      !draftFilters.facultyId &&
      !draftFilters.sectionId &&
      !draftFilters.batchId &&
      !draftFilters.feedbackRoundId &&
      !draftFilters.assignmentType
    ) {
      toast.error("Select at least one filter");
      return;
    }
    setAppliedFilters(draftFilters);
    setHasRunReport(true);
  };
  const updateFilter = (key: keyof Filters, value: string) => {
    setDraftFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === "courseId") {
        next.sectionId = "";
        next.batchId = "";
      }
      if (key === "sectionId") {
        next.batchId = "";
      }
      return next;
    });
    setHasRunReport(false);
  };
  const changeTerm = (termId: string) => {
    setDraftFilters({ ...EMPTY_FILTERS, academicTermId: termId });
    setAppliedFilters(EMPTY_FILTERS);
    setHasRunReport(false);
  };
  const changeSemester = (semester: string) => {
    setDraftFilters((current) => ({ ...current, semesterId: semester }));
    setAppliedFilters(EMPTY_FILTERS);
    setHasRunReport(false);
  };
  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setHasRunReport(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground text-sm">
            Pick an academic term and semester, set filters, click Apply, and
            view completed-round results.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => downloadFeedbackCsv(rows)}
          disabled={!rows.length}
        >
          Export CSV
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <select
            className={selectClass}
            value={draftFilters.academicTermId}
            onChange={(event) => changeTerm(event.target.value)}
          >
            <option value="">Select academic term</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.type.toUpperCase()} {term.year}
                {term.isCurrent ? " (Current)" : ""}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={draftFilters.semesterId}
            onChange={(event) => changeSemester(event.target.value)}
            disabled={!draftFilters.academicTermId}
          >
            <option value="">Select semester</option>
            {semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.programType.toUpperCase()} - Semester{" "}
                {semester.semesterNumber}
              </option>
            ))}
          </select>
          {canSelectFaculty && (
            <select
              className={selectClass}
              value={draftFilters.courseId}
              onChange={(event) => updateFilter("courseId", event.target.value)}
            >
              <option value="">All courses</option>
              {options?.courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          )}
          <select
            className={selectClass}
            value={draftFilters.facultyId}
            onChange={(event) => updateFilter("facultyId", event.target.value)}
          >
            <option value="">All faculty</option>
            {options?.faculty.map((item) => (
              <option key={item.id} value={item.id}>
                {item.user.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={draftFilters.sectionId}
            onChange={(event) => updateFilter("sectionId", event.target.value)}
          >
            <option value="">All sections</option>
            {options?.sections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.isElectiveBatch ? `${item.name} (Group)` : item.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={draftFilters.batchId}
            onChange={(event) => updateFilter("batchId", event.target.value)}
          >
            <option value="">All batches</option>
            {options?.batches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={draftFilters.assignmentType}
            onChange={(event) =>
              updateFilter("assignmentType", event.target.value)
            }
          >
            <option value="">Theory and lab</option>
            <option value="THEORY">Theory</option>
            <option value="LAB">Lab</option>
          </select>
          <select
            className={selectClass}
            value={draftFilters.feedbackRoundId}
            onChange={(event) =>
              updateFilter("feedbackRoundId", event.target.value)
            }
          >
            <option value="">All rounds</option>
            {options?.rounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.name || `Round ${round.roundNumber}`}
              </option>
            ))}
          </select>
          <div className="flex gap-2 md:col-span-3">
            <Button onClick={applyFilters}>Apply Filters</Button>
            <Button variant="outline" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
      {!hasRunReport ? (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">
            Select an academic term, semester, and at least one filter, then
            click Apply Filters to load the report.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <p className="text-muted-foreground text-sm">Loading report...</p>
      ) : isError ? (
        <p className="text-destructive text-sm">
          Unable to load feedback report.
        </p>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Faculty</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Round</TableHead>
                  <TableHead>Responses</TableHead>
                  {Array.from({ length: 10 }, (_, index) => (
                    <TableHead key={index}>Q{index + 1}</TableHead>
                  ))}
                  <TableHead>Average / 5</TableHead>
                  <TableHead>Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow
                    key={`${row.course.code}-${row.section}-${row.roundNumber}-${row.assignmentType}`}
                  >
                    <TableCell>{row.faculty.user.name}</TableCell>
                    <TableCell>{row.course.code}</TableCell>
                    <TableCell>{row.assignmentType}</TableCell>
                    <TableCell>
                      {row.section}
                      {row.batch ? ` / ${row.batch}` : ""}
                    </TableCell>
                    <TableCell>
                      {row.roundName || `Round ${row.roundNumber}`}
                    </TableCell>
                    <TableCell>{row.responseCount}</TableCell>
                    {row.questionAverages.map((average, index) => (
                      <TableCell key={index}>{average.toFixed(2)}</TableCell>
                    ))}
                    <TableCell>{row.average.toFixed(2)}</TableCell>
                    <TableCell>{row.percentage.toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
