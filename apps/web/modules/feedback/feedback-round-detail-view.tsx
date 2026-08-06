"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Input } from "@webcampus/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  downloadFeedbackCsvRows,
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

type AggregatedRow = {
  facultyName: string;
  courseCode: string;
  courseName: string;
  assignmentType: string;
  sections: number;
  responseCount: number;
  questionAverages: number[];
  average: number;
  percentage: number;
};

const SCORE_HEADERS = [
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "Q5",
  "Q6",
  "Q7",
  "Q8",
  "Q9",
  "Q10",
];

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

export function FeedbackRoundDetailView({ roundId }: { roundId: string }) {
  const [facultyId, setFacultyId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [sectionId, setSectionId] = useState("");

  const [reportDeptId, setReportDeptId] = useState("");
  const [reportCourseId, setReportCourseId] = useState("");
  const [reportMinScore, setReportMinScore] = useState("");
  const [appliedReport, setAppliedReport] = useState<{
    departmentId?: string;
    courseId?: string;
    minScore?: string;
  } | null>(null);

  const { data: facultyData } = useQuery<{
    round: RoundMeta;
    faculties: FacultyItem[];
  }>({
    queryKey: ["round-faculties", roundId],
    queryFn: () => getRoundFaculties(roundId),
  });
  const round: RoundMeta | undefined = facultyData?.round;
  const faculties = facultyData?.faculties ?? [];

  const { data: courses } = useQuery<CourseItem[]>({
    queryKey: ["round-courses", roundId, facultyId],
    queryFn: () => getRoundFacultyCourses(roundId, facultyId),
    enabled: Boolean(facultyId),
  });

  const { data: sections } = useQuery<SectionItem[]>({
    queryKey: ["round-sections", roundId, facultyId, courseId],
    queryFn: () => getRoundCourseSections(roundId, facultyId, courseId),
    enabled: Boolean(facultyId && courseId),
  });

  const { data: students } = useQuery<{
    filled: StudentItem[];
    notFilled: StudentItem[];
  }>({
    queryKey: ["round-students", roundId, facultyId, courseId, sectionId],
    queryFn: () =>
      getRoundSectionStudents(roundId, facultyId, courseId, sectionId),
    enabled: Boolean(facultyId && courseId && sectionId),
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

  const { data: courseReport = [] } = useQuery<ReportRow[]>({
    queryKey: ["feedback-course-report", roundId, facultyId, courseId],
    queryFn: () =>
      getFeedbackReport(
        {
          feedbackRoundId: roundId,
          facultyId,
          courseId,
          includeOpen: true,
        } as never,
        "admin"
      ),
    enabled: Boolean(facultyId && courseId),
  });

  const aggregated = useMemo(() => aggregateReport(reportRows), [reportRows]);

  const selectedFaculty = faculties.find((item) => item.id === facultyId);
  const selectedCourse = courses?.find((item) => item.id === courseId);

  const buildScoreRow = (row: ReportRow) => [
    row.faculty.user.name,
    `${row.course.code} - ${row.course.name}`,
    row.assignmentType,
    row.section,
    row.responseCount,
    ...row.questionAverages.map((value) => value.toFixed(2)),
    row.average.toFixed(2),
    `${row.percentage.toFixed(2)}%`,
  ];

  const downloadCourseReport = (format: "csv" | "pdf") => {
    if (!courseReport.length) {
      toast.error("No responses recorded for this course yet.");
      return;
    }
    const headers = [
      "Faculty",
      "Course",
      "Type",
      "Section",
      "Responses",
      ...SCORE_HEADERS,
      "Average / 5",
      "Percentage",
    ];
    const rows = courseReport.map(buildScoreRow);
    const filename = `feedback-${selectedFaculty?.shortName ?? "faculty"}-${selectedCourse?.code ?? "course"}.${format}`;
    const metadata = [
      `Round: ${round?.name ?? ""}`,
      `Academic Term: ${round?.academicTerm.type.toUpperCase()} ${round?.academicTerm.year}`,
      `Semester: ${round?.semester.programType} - ${round?.semester.semesterNumber}`,
      `Faculty: ${selectedFaculty?.name ?? ""}`,
      `Course: ${selectedCourse?.code ?? ""} - ${selectedCourse?.name ?? ""}`,
      "Scores are averages on a 5-point scale.",
    ];
    if (format === "csv") {
      downloadFeedbackCsvRows(headers, rows, filename);
    } else {
      downloadFeedbackPdf({
        title: "Feedback Report",
        metadata,
        headers,
        rows,
        filename,
      });
    }
  };

  const downloadReportTable = (format: "csv" | "pdf") => {
    if (!aggregated.length) {
      toast.error("No report rows to download.");
      return;
    }
    const headers = [
      "Faculty",
      "Course",
      "Type",
      "Sections",
      "Responses",
      ...SCORE_HEADERS,
      "Average / 5",
      "Percentage",
    ];
    const rows = aggregated.map((row) => [
      row.facultyName,
      `${row.courseCode} - ${row.courseName}`,
      row.assignmentType,
      row.sections,
      row.responseCount,
      ...row.questionAverages.map((value) => value.toFixed(2)),
      row.average.toFixed(2),
      `${row.percentage.toFixed(2)}%`,
    ]);
    const metadata = [
      `Round: ${round?.name ?? ""}`,
      `Academic Term: ${round?.academicTerm.type.toUpperCase()} ${round?.academicTerm.year}`,
      `Semester: ${round?.semester.programType} - ${round?.semester.semesterNumber}`,
      "One row per faculty and course offering.",
    ];
    if (format === "csv") {
      downloadFeedbackCsvRows(
        headers,
        rows,
        `feedback-report-${round?.name}.csv`
      );
    } else {
      downloadFeedbackPdf({
        title: "Faculty Feedback Report",
        metadata,
        headers,
        rows,
        filename: `feedback-report-${round?.name}.pdf`,
      });
    }
  };

  const applyReportFilters = () => {
    if (!reportDeptId && !reportCourseId && !reportMinScore) {
      toast.error("Select at least one filter");
      return;
    }
    setAppliedReport({
      ...(reportDeptId ? { departmentId: reportDeptId } : {}),
      ...(reportCourseId ? { courseId: reportCourseId } : {}),
      ...(reportMinScore ? { minScore: reportMinScore } : {}),
    });
  };

  const resetDrillDown = () => {
    setFacultyId("");
    setCourseId("");
    setSectionId("");
  };

  const termLabel = round
    ? `${round.academicTerm.type.toUpperCase()} ${round.academicTerm.year}`
    : "";
  const semesterLabel = round
    ? `${round.semester.programType.toUpperCase()} - Semester ${round.semester.semesterNumber}`
    : "";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/admin/academics/feedback" className="underline">
            Feedback Dashboard
          </Link>
          {" / "}
          <span className="font-medium">{round?.name ?? "Round"}</span>
          {selectedFaculty ? (
            <>
              {" / "}
              <span className="font-medium">{selectedFaculty.name}</span>
            </>
          ) : null}
          {selectedCourse ? (
            <>
              {" / "}
              <span className="font-medium">{selectedCourse.code}</span>
            </>
          ) : null}
          {sectionId ? (
            <>
              {" / "}
              <span className="font-medium">
                {sections?.find((item) => item.sectionId === sectionId)
                  ?.sectionName ?? "Section"}
              </span>
            </>
          ) : null}
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
          <CardTitle>Browse Responses</CardTitle>
          {(facultyId || courseId || sectionId) && (
            <Button variant="ghost" onClick={resetDrillDown}>
              Reset
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!facultyId ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {faculties.map((faculty) => (
                <Button
                  key={faculty.id}
                  variant="outline"
                  onClick={() => setFacultyId(faculty.id)}
                  className="justify-start"
                >
                  {faculty.name}
                </Button>
              ))}
            </div>
          ) : !courseId ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Courses handled by {selectedFaculty?.name} this semester:
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {courses?.map((course) => (
                  <Button
                    key={course.id}
                    variant="outline"
                    onClick={() => setCourseId(course.id)}
                    className="justify-start"
                  >
                    {course.code} - {course.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : !sectionId ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-muted-foreground text-sm">
                  Sections for {selectedCourse?.code} - {selectedCourse?.name}:
                </p>
                <Button
                  variant="outline"
                  onClick={() => downloadCourseReport("csv")}
                >
                  Download report (CSV)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadCourseReport("pdf")}
                >
                  Download report (PDF)
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sections?.map((section) => (
                  <Button
                    key={section.sectionId}
                    variant="outline"
                    onClick={() => setSectionId(section.sectionId)}
                    className="justify-start"
                  >
                    {section.sectionName} ({section.assignmentType}) - filled{" "}
                    {section.filledCount}/{section.enrolledCount}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 font-medium">
                  Students filled ({students?.filled.length ?? 0})
                </h3>
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
                    No responses yet.
                  </p>
                )}
              </div>
              <div>
                <h3 className="mb-2 font-medium">
                  Students not filled ({students?.notFilled.length ?? 0})
                </h3>
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
                    Everyone has submitted.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Faculty Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
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
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
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
              min={1}
              max={5}
              step={0.1}
              placeholder="Min average score (1-5)"
              value={reportMinScore}
              onChange={(event) => setReportMinScore(event.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={applyReportFilters}>Apply</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setReportDeptId("");
                  setReportCourseId("");
                  setReportMinScore("");
                  setAppliedReport(null);
                }}
              >
                Reset
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => downloadReportTable("csv")}
              disabled={!aggregated.length}
            >
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadReportTable("pdf")}
              disabled={!aggregated.length}
            >
              Export PDF
            </Button>
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
                  {SCORE_HEADERS.map((header) => (
                    <TableHead key={header}>{header}</TableHead>
                  ))}
                  <TableHead>Average / 5</TableHead>
                  <TableHead>Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!appliedReport ? (
                  <TableRow>
                    <TableCell
                      colSpan={20}
                      className="text-muted-foreground text-center"
                    >
                      Apply filters to load the report.
                    </TableCell>
                  </TableRow>
                ) : aggregated.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={20}
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
                      {row.questionAverages.map((value, index) => (
                        <TableCell key={index}>{value.toFixed(2)}</TableCell>
                      ))}
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
