"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  DEFAULT_FILTER_ALL_VALUE,
  FilterActions,
  FilterBuilder,
  type FilterFieldConfig,
  type FilterOption,
} from "@webcampus/ui/components/filter-builder";
import { Input } from "@webcampus/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  getCourseDistribution,
  getFeedbackFilterOptions,
  getFeedbackReport,
  getRoundCourseSections,
  getRoundFaculties,
  getRoundFacultyCourses,
  getRoundSectionStudents,
} from "./feedback-api";
import { downloadFeedbackPdf } from "./feedback-pdf";

type ReportRow = {
  course: { code: string; name: string };
  faculty: { user: { name: string } };
  assignmentType: string;
  section: string;
  roundNumber: number;
  roundName: string;
  batch: string | null;
  departmentName: string;
  responseCount: number;
  questionAverages: number[];
  average: number;
  percentage: number;
};

type RoundMeta = {
  id: string;
  roundNumber: number;
  name: string;
  startsAt: string;
  endsAt: string;
  academicTermId: string;
  semesterId: string;
  academicTerm: { type: string; year: string; isCurrent: boolean };
  semester: { programType: "UG" | "PG"; semesterNumber: number };
};

type FacultyItem = { id: string; shortName: string; name: string };
type CourseItem = {
  id: string;
  code: string;
  name: string;
  sectionCount: number;
  departmentName?: string;
};
type SectionItem = {
  assignmentId: string;
  sectionId: string;
  sectionName: string;
  assignmentType: string;
  enrolledCount: number;
  filledCount: number;
  notFilledCount: number;
};
type StudentItem = { name: string; usn: string };

type Card1Filters = {
  departmentId: string;
  facultyId: string;
  courseId: string;
  sectionId: string;
};

const EMPTY_CARD1_FILTERS: Card1Filters = {
  departmentId: "",
  facultyId: "",
  courseId: "",
  sectionId: "",
};

type AggregatedRow = {
  facultyName: string;
  courseCode: string;
  courseName: string;
  assignmentType: string;
  departmentName: string;
  sections: number;
  responseCount: number;
  questionAverages: number[];
  average: number;
  percentage: number;
};

const aggregateReport = (rows: ReportRow[]): AggregatedRow[] => {
  const map = new Map<string, AggregatedRow>();
  for (const row of rows) {
    const key = `${row.faculty.user.name}:${row.course.code}:${row.assignmentType}`;
    const existing = map.get(key);
    if (existing) {
      existing.responseCount += row.responseCount;
      existing.sections += 1;
      row.questionAverages.forEach(
        (value, index) =>
          (existing.questionAverages[index] =
            (existing.questionAverages[index] ?? 0) + value * row.responseCount)
      );
    } else {
      map.set(key, {
        facultyName: row.faculty.user.name,
        courseCode: row.course.code,
        courseName: row.course.name,
        assignmentType: row.assignmentType,
        departmentName: row.departmentName,
        sections: 1,
        responseCount: row.responseCount,
        questionAverages: row.questionAverages.map(
          (value) => value * row.responseCount
        ),
        average: 0,
        percentage: 0,
      });
    }
  }
  return [...map.values()].map((group) => {
    const questionAverages = group.questionAverages.map(
      (total) => total / group.responseCount
    );
    const average =
      questionAverages.reduce((sum, value) => sum + value, 0) / 10;
    return {
      ...group,
      questionAverages,
      average,
      percentage: (average / 5) * 100,
    };
  });
};

const rowAverage = (q: {
  excellent: number;
  veryGood: number;
  good: number;
  fair: number;
  poor: number;
  rowTotal: number;
}) => {
  const total =
    q.excellent * 5 + q.veryGood * 4 + q.good * 3 + q.fair * 2 + q.poor;
  return q.rowTotal > 0 ? total / q.rowTotal : 0;
};

const DISTRIBUTION_HEADERS = [
  "Q.No",
  "Question",
  "Excellent",
  "Very Good",
  "Good",
  "Fair",
  "Poor",
  "Total",
  "Average",
];

export function FeedbackRoundDetailView({ roundId }: { roundId: string }) {
  const [showStudents, setShowStudents] = useState(false);

  const [draftFilters, setDraftFilters] =
    useState<Card1Filters>(EMPTY_CARD1_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<Card1Filters>(EMPTY_CARD1_FILTERS);

  const [reportDeptId, setReportDeptId] = useState("");
  const [reportCourseId, setReportCourseId] = useState("");
  const [reportMaxPercentage, setReportMaxPercentage] = useState("");
  const [appliedReport, setAppliedReport] = useState<{
    departmentId?: string;
    courseId?: string;
    maxPercentage?: string;
  } | null>(null);

  const { data: facultyData } = useQuery<{
    round: RoundMeta;
    faculties: FacultyItem[];
  }>({
    queryKey: ["round-faculties", roundId, draftFilters.departmentId],
    queryFn: () =>
      getRoundFaculties(roundId, draftFilters.departmentId || undefined),
  });
  const round: RoundMeta | undefined = facultyData?.round;
  const faculties = facultyData?.faculties ?? [];

  const { data: courses, isLoading: coursesLoading } = useQuery<CourseItem[]>({
    queryKey: ["round-courses", roundId, draftFilters.facultyId],
    queryFn: () => getRoundFacultyCourses(roundId, draftFilters.facultyId),
    enabled: Boolean(draftFilters.facultyId),
  });

  const { data: sections, isLoading: sectionsLoading } = useQuery<
    SectionItem[]
  >({
    queryKey: [
      "round-sections",
      roundId,
      draftFilters.facultyId,
      draftFilters.courseId,
    ],
    queryFn: () =>
      getRoundCourseSections(
        roundId,
        draftFilters.facultyId,
        draftFilters.courseId
      ),
    enabled: Boolean(draftFilters.facultyId && draftFilters.courseId),
  });

  const { data: students } = useQuery<{
    filled: StudentItem[];
    notFilled: StudentItem[];
  }>({
    queryKey: [
      "round-students",
      roundId,
      appliedFilters.facultyId,
      appliedFilters.courseId,
      appliedFilters.sectionId,
    ],
    queryFn: () =>
      getRoundSectionStudents(
        roundId,
        appliedFilters.facultyId,
        appliedFilters.courseId,
        appliedFilters.sectionId
      ),
    enabled: Boolean(
      appliedFilters.facultyId &&
        appliedFilters.courseId &&
        appliedFilters.sectionId
    ),
  });

  const { data: distribution } = useQuery({
    queryKey: [
      "course-distribution",
      roundId,
      appliedFilters.facultyId,
      appliedFilters.courseId,
      appliedFilters.sectionId,
    ],
    queryFn: () =>
      getCourseDistribution(
        roundId,
        appliedFilters.facultyId,
        appliedFilters.courseId,
        appliedFilters.sectionId || undefined
      ),
    enabled: Boolean(appliedFilters.facultyId && appliedFilters.courseId),
  });

  const { data: filterOptions } = useQuery({
    queryKey: [
      "feedback-filter-options",
      "admin",
      round?.academicTermId,
      round?.semesterId,
    ],
    queryFn: () =>
      getFeedbackFilterOptions("admin", {
        academicTermId: round?.academicTermId,
        semesterId: round?.semesterId,
      }),
    enabled: Boolean(round?.academicTermId && round?.semesterId),
  });

  const { data: reportRows = [] } = useQuery<ReportRow[]>({
    queryKey: ["feedback-round-report", roundId, appliedReport],
    queryFn: () =>
      getFeedbackReport(
        {
          feedbackRoundId: roundId,
          includeOpen: true,
          ...(appliedReport ?? {}),
        } as never,
        "admin"
      ),
    enabled: Boolean(appliedReport),
  });

  const aggregated = useMemo(() => aggregateReport(reportRows), [reportRows]);

  const selectedFaculty = faculties.find(
    (item) => item.id === appliedFilters.facultyId
  );
  const selectedCourse = courses?.find(
    (item) => item.id === appliedFilters.courseId
  );

  const resetDrillDown = () => {
    setDraftFilters(EMPTY_CARD1_FILTERS);
    setAppliedFilters(EMPTY_CARD1_FILTERS);
  };

  const downloadCourseReport = () => {
    if (!distribution) {
      toast.error("No distribution data to download.");
      return;
    }
    const filename = `feedback-${selectedFaculty?.shortName ?? "faculty"}-${selectedCourse?.code ?? "course"}.pdf`;
    downloadFeedbackPdf({
      metadata: {
        academicYear: distribution.metadata.academicYear,
        semester: distribution.metadata.semester,
        program: distribution.metadata.program,
        branch: distribution.metadata.branch,
        courseCode: distribution.metadata.courseCode,
        courseName: distribution.metadata.courseName,
        section: distribution.metadata.section,
        facultyName: distribution.metadata.facultyName,
        totalStudents: distribution.metadata.totalStudents,
      },
      questions: distribution.questions.map((q) => ({
        qNo: q.questionNumber,
        question: q.questionText,
        excellent: q.excellent,
        veryGood: q.veryGood,
        good: q.good,
        fair: q.fair,
        poor: q.poor,
        rowTotal: q.rowTotal,
        rowAverage: rowAverage(q).toFixed(2),
      })),
      totals: {
        excellent: distribution.totals.excellent,
        veryGood: distribution.totals.veryGood,
        good: distribution.totals.good,
        fair: distribution.totals.fair,
        poor: distribution.totals.poor,
        overallAverage: distribution.totals.overallAverage.toFixed(2),
      },
      filename,
    });
  };

  const applyReportFilters = () => {
    if (!reportDeptId && !reportCourseId && !reportMaxPercentage) {
      toast.error("Select at least one filter");
      return;
    }
    setAppliedReport({
      ...(reportDeptId ? { departmentId: reportDeptId } : {}),
      ...(reportCourseId ? { courseId: reportCourseId } : {}),
      ...(reportMaxPercentage ? { maxPercentage: reportMaxPercentage } : {}),
    });
  };

  const resetAppliedReport = () => {
    setReportDeptId("");
    setReportCourseId("");
    setReportMaxPercentage("");
    setAppliedReport(null);
  };

  const termLabel = round
    ? `${round.academicTerm.type.toUpperCase()} ${round.academicTerm.year}`
    : "";
  const semesterLabel = round
    ? `${round.semester.programType.toUpperCase()} - Semester ${round.semester.semesterNumber} (${round.semester.programType === "UG" ? "B.E" : "M.Tech"})`
    : "";

  const selectClass =
    "border-input bg-background h-9 rounded-md border px-3 text-sm";

  const handleCard1DraftChange = (key: keyof Card1Filters, value: string) => {
    setDraftFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === "departmentId") {
        next.facultyId = "";
        next.courseId = "";
        next.sectionId = "";
      } else if (key === "facultyId") {
        next.courseId = "";
        next.sectionId = "";
      } else if (key === "courseId") {
        next.sectionId = "";
      }
      return next;
    });
  };

  const applyCard1Filters = () => {
    setAppliedFilters(draftFilters);
  };

  const resetCard1Filters = () => {
    setDraftFilters(EMPTY_CARD1_FILTERS);
    setAppliedFilters(EMPTY_CARD1_FILTERS);
  };

  const card1Fields: FilterFieldConfig<Card1Filters>[] = [
    {
      key: "departmentId",
      label: "Department",
      type: "select",
      allOptionLabel: "All departments",
      options:
        filterOptions?.departments.map<FilterOption>((department) => ({
          label: department.name,
          value: department.id,
        })) ?? [],
    },
    {
      key: "facultyId",
      label: "Faculty",
      type: "select",
      hideAllOption: true,
      placeholder: "Select faculty",
      options: faculties.map<FilterOption>((faculty) => ({
        label: faculty.name,
        value: faculty.id,
      })),
    },
    {
      key: "courseId",
      label: "Course",
      type: "select",
      hideAllOption: true,
      placeholder: coursesLoading ? "Loading courses..." : "Select course",
      options:
        courses?.map<FilterOption>((course) => ({
          label: `${course.code} - ${course.name}`,
          value: course.id,
        })) ?? [],
    },
    {
      key: "sectionId",
      label: "Section",
      type: "select",
      allOptionLabel: "All sections (combined)",
      placeholder: !draftFilters.courseId
        ? "Select course first"
        : sectionsLoading
          ? "Loading sections..."
          : "All sections (combined)",
      options:
        sections?.map<FilterOption>((section) => ({
          label: section.sectionName,
          value: section.sectionId,
        })) ?? [],
      formatOptionLabel: (option) => {
        const section = sections?.find(
          (item) => item.sectionId === option.value
        );
        if (!section) return option.label as string;
        return `${section.sectionName} (${section.assignmentType}) - filled ${section.filledCount}/${section.enrolledCount}`;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/admin/academics/feedback" className="underline">
            Feedback Dashboard
          </Link>
          {" / "}
          <span className="font-medium">{round?.name ?? "Round"}</span>
        </p>
        <h1 className="text-2xl font-semibold">
          {round?.name ?? "Feedback Round"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {termLabel}
          {semesterLabel ? ` | ${semesterLabel}` : ""}
          {round
            ? ` | ${new Date(round.startsAt).toLocaleDateString()} - ${new Date(
                round.endsAt
              ).toLocaleDateString()}`
            : ""}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Faculty Report</CardTitle>
          {appliedFilters.facultyId && (
            <Button variant="ghost" onClick={resetDrillDown}>
              Reset
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterBuilder
            fields={card1Fields}
            draftFilters={draftFilters}
            onDraftChange={handleCard1DraftChange}
            allValue={DEFAULT_FILTER_ALL_VALUE}
          />
          <FilterActions
            onApply={applyCard1Filters}
            onReset={resetCard1Filters}
            applyLabel="Apply Filters"
            resetLabel="Reset Filters"
          />

          {appliedFilters.facultyId && appliedFilters.courseId ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-muted-foreground text-sm">
                  {distribution
                    ? `${distribution.metadata.facultyName} - ${distribution.metadata.courseCode} (${distribution.metadata.section}) | ${distribution.metadata.totalStudents} respondent(s)`
                    : "Loading distribution..."}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCourseReport()}
                  >
                    Download report (PDF)
                  </Button>
                  {appliedFilters.sectionId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowStudents(true)}
                    >
                      Student Details
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {DISTRIBUTION_HEADERS.map((header) => (
                        <TableHead key={header}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distribution?.questions.map((q) => (
                      <TableRow key={q.questionNumber}>
                        <TableCell>{q.questionNumber}</TableCell>
                        <TableCell className="text-left">
                          {q.questionText}
                        </TableCell>
                        <TableCell>{q.excellent}</TableCell>
                        <TableCell>{q.veryGood}</TableCell>
                        <TableCell>{q.good}</TableCell>
                        <TableCell>{q.fair}</TableCell>
                        <TableCell>{q.poor}</TableCell>
                        <TableCell>{q.rowTotal}</TableCell>
                        <TableCell>{rowAverage(q).toFixed(2)}</TableCell>
                      </TableRow>
                    )) ?? (
                      <TableRow>
                        <TableCell
                          colSpan={DISTRIBUTION_HEADERS.length}
                          className="text-muted-foreground text-center"
                        >
                          Loading distribution...
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {distribution ? (
                    <TableFooter>
                      <TableRow className="font-medium">
                        <TableCell colSpan={2}>Total</TableCell>
                        <TableCell>{distribution.totals.excellent}</TableCell>
                        <TableCell>{distribution.totals.veryGood}</TableCell>
                        <TableCell>{distribution.totals.good}</TableCell>
                        <TableCell>{distribution.totals.fair}</TableCell>
                        <TableCell>{distribution.totals.poor}</TableCell>
                        <TableCell>
                          {distribution.questions.reduce(
                            (sum, q) => sum + q.rowTotal,
                            0
                          )}
                        </TableCell>
                        <TableCell>
                          {distribution.totals.overallAverage.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  ) : null}
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Select a faculty, then a course to load the distribution report.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={showStudents} onOpenChange={setShowStudents}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
            <DialogDescription>
              Students who filled and did not fill feedback for{" "}
              {selectedFaculty?.name ?? "faculty"} -{" "}
              {selectedCourse?.code ?? "course"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-muted-foreground mb-2 text-sm font-medium">
                Filled ({students?.filled.length ?? 0})
              </p>
              {students?.filled.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>USN</TableHead>
                      <TableHead>Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.filled.map((student) => (
                      <TableRow key={student.usn}>
                        <TableCell>{student.usn}</TableCell>
                        <TableCell>{student.name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No students have filled the feedback yet.
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground mb-2 text-sm font-medium">
                Not filled ({students?.notFilled.length ?? 0})
              </p>
              {students?.notFilled.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>USN</TableHead>
                      <TableHead>Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.notFilled.map((student) => (
                      <TableRow key={student.usn}>
                        <TableCell>{student.usn}</TableCell>
                        <TableCell>{student.name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">
                  All students have filled the feedback.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowStudents(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Course Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <select
              className={selectClass}
              value={reportDeptId}
              onChange={(event) => setReportDeptId(event.target.value)}
            >
              <option value="">All departments</option>
              {filterOptions?.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={reportCourseId}
              onChange={(event) => setReportCourseId(event.target.value)}
            >
              <option value="">All courses</option>
              {filterOptions?.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.name}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              placeholder="Below percentage (%)"
              value={reportMaxPercentage}
              onChange={(event) => setReportMaxPercentage(event.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={applyReportFilters}>Apply</Button>
              <Button variant="outline" onClick={resetAppliedReport}>
                Reset
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Faculty</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sections</TableHead>
                  <TableHead>Responses</TableHead>
                  <TableHead>Average / 5</TableHead>
                  <TableHead>Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!appliedReport ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground text-center"
                    >
                      Apply filters to load the report.
                    </TableCell>
                  </TableRow>
                ) : aggregated.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground text-center"
                    >
                      No completed feedback matches the filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  aggregated.map((row) => (
                    <TableRow
                      key={`${row.facultyName}:${row.courseCode}:${row.assignmentType}`}
                    >
                      <TableCell>{row.facultyName}</TableCell>
                      <TableCell>
                        {row.courseCode} - {row.courseName}
                      </TableCell>
                      <TableCell>{row.assignmentType}</TableCell>
                      <TableCell>{row.sections}</TableCell>
                      <TableCell>{row.responseCount}</TableCell>
                      <TableCell>{row.average.toFixed(2)}</TableCell>
                      <TableCell>{row.percentage.toFixed(2)}%</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
