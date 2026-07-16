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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import {
  useHODMarksAssessments,
  useHODMarksCourses,
  useHODMarksFilterOptions,
  useHODMarksReportData,
  useHODMarksSections,
  type Assessment,
} from "./use-hod-marks-report";

type MarksFilterState = {
  academicTermId: string;
  semesterId: string;
  courseId: string;
  sectionId: string;
  cycle: string;
};

const EMPTY_FILTERS: MarksFilterState = {
  academicTermId: "",
  semesterId: "",
  courseId: "",
  sectionId: "",
  cycle: "",
};

export const HODMarksReportView = () => {
  const [draftFilters, setDraftFilters] =
    useState<MarksFilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<MarksFilterState | null>(
    null
  );

  const [selectedAssessment, setSelectedAssessment] =
    useState<Assessment | null>(null);

  // Fetch Options
  const { data: optionsData } = useHODMarksFilterOptions();
  const isBasicSciences = optionsData?.departmentType === "BASIC_SCIENCES";

  const { data: courses = [] } = useHODMarksCourses(
    draftFilters.semesterId,
    draftFilters.cycle
  );
  const { data: sections = [] } = useHODMarksSections(
    draftFilters.semesterId,
    draftFilters.courseId,
    draftFilters.cycle
  );
  const { data: assessments = [], isLoading: loadingAssessments } =
    useHODMarksAssessments(appliedFilters?.courseId || "");
  const { data: reportData = [], isLoading: loadingReport } =
    useHODMarksReportData(
      appliedFilters?.sectionId || "",
      selectedAssessment?.id || ""
    );

  const filterFields: FilterFieldConfig<typeof EMPTY_FILTERS>[] = [
    {
      key: "academicTermId",
      label: "Academic Term",
      type: "select",
      hideAllOption: true,
       
      options:
        optionsData?.academicTerms.map((t) => ({
          label: `${t.type.charAt(0).toUpperCase() + t.type.slice(1)} ${t.year}`,
          value: t.id,
        })) || [],
    },
    {
      key: "semesterId",
      label: "Semester",
      type: "select",
      hideAllOption: true,
      options:
        optionsData?.semesters.map((s) => ({
          label: `Semester ${s.semesterNumber}`,
          value: s.id,
        })) || [],
    },
    ...(isBasicSciences
      ? [
          {
            key: "cycle",
            label: "Cycle",
            type: "select",
            hideAllOption: true,
            options: [
              { label: "PHYSICS", value: "PHYSICS" },
              { label: "CHEMISTRY", value: "CHEMISTRY" },
            ],
          } as FilterFieldConfig<typeof EMPTY_FILTERS>,
        ]
      : []),
    {
      key: "courseId",
      label: "Course",
      type: "select",
      hideAllOption: true,
      options: courses.map((c) => ({
        label: `${c.code} - ${c.name}`,
        value: c.id,
      })),
    },
    {
      key: "sectionId",
      label: "Section",
      type: "select",
      hideAllOption: true,
       
      options: sections.map((s) => ({ label: s.name, value: s.id })),
    },
  ];

  const handleApply = () => {
    setAppliedFilters(draftFilters);
    setSelectedAssessment(null);
  };

  const handleReset = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(null);
    setSelectedAssessment(null);
  };

  const handleDownloadPDF = () => {
    if (!reportData || !selectedAssessment) return;
    const doc = new jsPDF("p", "pt", "a4");

    doc.setFontSize(16);
    doc.text(`Marks Report - ${selectedAssessment.title}`, 40, 40);
    doc.setFontSize(10);
    const course = courses.find((c) => c.id === appliedFilters?.courseId);
    doc.text(
      `Course: ${course?.code} | Max Marks: ${selectedAssessment.totalMarks}`,
      40,
      60
    );

    const body = reportData.map((r) => [
      r.usn,
      r.name,
      r.marksObtained !== null ? r.marksObtained : "-",
      selectedAssessment.totalMarks,
    ]);

    autoTable(doc, {
      head: [["USN", "Name", "Marks Obtained", "Total Marks"]],
      body,
      startY: 80,
      headStyles: { fillColor: [41, 128, 185] },
    });
    doc.save(`Marks_${course?.code}_${selectedAssessment.title}.pdf`);
    toast.success("PDF downloaded successfully");
  };

  const handleDownloadExcel = () => {
    toast.info("Excel download starting...");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">HOD Marks Reports</h2>
        <p className="text-muted-foreground text-sm">
          View and download assessment marks across your department.
        </p>
      </div>

      <FilterPanel>
        <FilterBuilder
          fields={filterFields}
          draftFilters={draftFilters}
          onDraftChange={(key, value) => {
            setDraftFilters((prev) => {
              const next = { ...prev, [key]: value };
              if (key === "semesterId" || key === "cycle") {
                next.courseId = "";
                next.sectionId = "";
              } else if (key === "courseId") {
                next.sectionId = "";
              }
              return next;
            });
          }}
          className="md:grid-cols-2 lg:grid-cols-3"
        />
        <FilterActions onApply={handleApply} onReset={handleReset} />
      </FilterPanel>

      {appliedFilters && !selectedAssessment && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Select an Assessment</h3>
          {loadingAssessments ? (
            <div className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="animate-spin" /> Loading assessments...
            </div>
          ) : assessments.length === 0 ? (
            <div className="text-muted-foreground rounded-md border p-8 text-center">
              No assessments found for this course.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              { }
              {assessments.map((a) => (
                <Card
                  key={a.id}
                  className="hover:border-primary cursor-pointer transition-colors"
                  onClick={() => setSelectedAssessment(a)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{a.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-sm">
                    Max Marks: {a.totalMarks}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedAssessment && (
        <div className="space-y-4 rounded-lg border p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">
                {selectedAssessment.title} Results
              </h3>
              <p className="text-muted-foreground text-sm">
                Max Marks: {selectedAssessment.totalMarks}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedAssessment(null)}
              >
                Back to Assessments
              </Button>
              <Button variant="outline" onClick={handleDownloadPDF}>
                <Download className="mr-2 h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" onClick={handleDownloadExcel}>
                <Download className="mr-2 h-4 w-4" /> Excel
              </Button>
            </div>
          </div>

          {loadingReport ? (
            <div className="flex justify-center p-8">
              <Loader2 className="text-muted-foreground animate-spin" />
            </div>
          ) : reportData.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center">
              No marks recorded for this section.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>USN</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Marks Obtained</TableHead>
                    <TableHead className="text-right">Max Marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((r) => (
                    <TableRow key={r.studentId}>
                      <TableCell className="font-mono">{r.usn}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right font-medium">
                        {r.marksObtained !== null ? (
                          r.marksObtained
                        ) : (
                          <Badge variant="secondary">N/A</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right">
                        {selectedAssessment.totalMarks}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
