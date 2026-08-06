"use client";

import type { MarksReportData } from "@/modules/faculty/marks-report/marks-report-types";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { cn } from "@webcampus/ui/lib/utils";
import { Download, Loader2 } from "lucide-react";

const formatScore = (value: number | null, max: number) => {
  if (value == null) return "-";
  return `${value}/${max}`;
};

export const MarksReportDetailedTable = ({
  reportData,
  isLoading,
  onDownloadPDF,
  onDownloadExcel,
  emptyMessage,
}: {
  reportData?: MarksReportData;
  isLoading: boolean;
  onDownloadPDF: () => void;
  onDownloadExcel: () => void;
  emptyMessage: string;
}) => (
  <div className="space-y-4">
    {reportData && reportData.students.length > 0 ? (
      <>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadExcel}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Detailed Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadPDF}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Detailed PDF
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  rowSpan={2}
                  className="bg-background sticky left-0 z-20 min-w-[100px] border-r align-bottom"
                >
                  USN
                </TableHead>
                <TableHead
                  rowSpan={2}
                  className="bg-background sticky left-[100px] z-20 min-w-[150px] border-r align-bottom"
                >
                  Student Name
                </TableHead>
                {reportData.assessments.map((a) => {
                  const hasQuestions = a.questions && a.questions.length > 0;
                  const colSpan = hasQuestions ? a.questions!.length + 1 : 1;
                  return (
                    <TableHead
                      key={a.id}
                      colSpan={colSpan}
                      className="whitespace-nowrap border-r px-4 text-center align-top"
                    >
                      <div className="font-semibold">{a.title}</div>
                      <div className="text-muted-foreground text-xs font-normal">
                        {a.componentType === "THEORY"
                          ? "Theory"
                          : a.componentType === "LAB"
                            ? "Lab"
                            : a.componentType || "Assessment"}
                      </div>
                    </TableHead>
                  );
                })}
                <TableHead
                  rowSpan={2}
                  className="min-w-[100px] border-l text-center align-bottom"
                >
                  Total CIE
                </TableHead>
                <TableHead
                  rowSpan={2}
                  className="min-w-[100px] border-l text-center align-bottom"
                >
                  Status
                </TableHead>
              </TableRow>
              <TableRow>
                {reportData.assessments.map((a) => {
                  const cells = [];
                  if (a.questions && a.questions.length > 0) {
                    a.questions.forEach((q) => {
                      cells.push(
                        <TableHead
                          key={q.id}
                          className="min-w-[60px] border-t px-2 text-center text-xs"
                        >
                          <div className="font-semibold">
                            {q.part
                              ? `${q.part}-${q.qNumber}`
                              : `Q${q.qNumber}`}
                          </div>
                          <div className="text-muted-foreground font-normal">
                            ({q.marks})
                          </div>
                        </TableHead>
                      );
                    });
                  }
                  cells.push(
                    <TableHead
                      key={`${a.id}-total`}
                      className="bg-muted/30 border-r border-t px-2 text-center text-xs"
                    >
                      <div className="font-semibold">Total</div>
                      <div className="text-muted-foreground font-normal">
                        ({a.totalMarks})
                      </div>
                    </TableHead>
                  );
                  return cells;
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.students.map((student) => {
                const isEligible = student.status === "ELIGIBLE";
                return (
                  <TableRow key={student.usn}>
                    <TableCell className="bg-background sticky left-0 z-10 border-r font-mono text-sm">
                      {student.usn}
                    </TableCell>
                    <TableCell className="bg-background sticky left-[100px] z-10 border-r font-medium">
                      {student.name}
                    </TableCell>
                    {reportData.assessments.map((a) => {
                      const score = student.assessments.find(
                        (s) => s.assessmentId === a.id
                      );
                      const cells = [];

                      if (a.questions && a.questions.length > 0) {
                        a.questions.forEach((q) => {
                          const qMark = score?.questionMarks?.[q.id];
                          cells.push(
                            <TableCell
                              key={`${student.usn}-${q.id}`}
                              className="text-center text-sm"
                            >
                              {qMark != null ? qMark : "-"}
                            </TableCell>
                          );
                        });
                      }

                      cells.push(
                        <TableCell
                          key={`${student.usn}-${a.id}-total`}
                          className={cn(
                            "bg-muted/10 border-r text-center font-medium",
                            score?.totalMarks != null &&
                              score.totalMarks < a.totalMarks * 0.4
                              ? "text-rose-600 dark:text-rose-500"
                              : "text-emerald-600 dark:text-emerald-500"
                          )}
                        >
                          {formatScore(score?.totalMarks ?? null, a.totalMarks)}
                        </TableCell>
                      );
                      return cells;
                    })}
                    <TableCell className="border-l text-center font-medium">
                      {student.cieTotal != null ? student.cieTotal : "-"}
                    </TableCell>
                    <TableCell className="border-l text-center">
                      <Badge
                        variant={isEligible ? "default" : "destructive"}
                        className={cn(
                          isEligible &&
                            "border-transparent bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                        )}
                      >
                        {isEligible ? "Eligible" : "Not Eligible"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </>
    ) : isLoading ? (
      <div className="text-muted-foreground flex min-h-[200px] items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading detailed report...
      </div>
    ) : (
      <div className="text-muted-foreground flex min-h-[200px] items-center justify-center">
        {emptyMessage}
      </div>
    )}
  </div>
);
