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

export const MarksReportTable = ({
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
            Download Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadPDF}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-background sticky left-0 z-10 min-w-[100px]">
                  USN
                </TableHead>
                <TableHead className="bg-background sticky left-[100px] z-10 min-w-[150px]">
                  Student Name
                </TableHead>
                {reportData.assessments.map((a) => (
                  <TableHead
                    key={a.id}
                    className="min-w-[100px] whitespace-nowrap text-center"
                  >
                    {a.title}
                    <div className="text-muted-foreground text-xs font-normal">
                      Max: {a.totalMarks}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="min-w-[100px] text-center">
                  Total CIE
                </TableHead>
                <TableHead className="min-w-[100px] text-center">
                  Min Required
                </TableHead>
                <TableHead className="min-w-[100px] text-center">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.students.map((student) => {
                const isEligible = student.status === "ELIGIBLE";
                return (
                  <TableRow key={student.usn}>
                    <TableCell className="bg-background sticky left-0 z-10 font-mono text-sm">
                      {student.usn}
                    </TableCell>
                    <TableCell className="bg-background sticky left-[100px] z-10 font-medium">
                      {student.name}
                    </TableCell>
                    {reportData.assessments.map((a) => {
                      const score = student.assessments.find(
                        (s) => s.assessmentId === a.id
                      );
                      return (
                        <TableCell
                          key={a.id}
                          className={cn(
                            "text-center",
                            score?.totalMarks != null &&
                              score.totalMarks < a.totalMarks * 0.4
                              ? "text-rose-600 dark:text-rose-500"
                              : "text-emerald-600 dark:text-emerald-500"
                          )}
                        >
                          {formatScore(score?.totalMarks ?? null, a.totalMarks)}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-medium">
                      {student.cieTotal != null ? student.cieTotal : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {`${reportData.course.cieMinMarks} (${reportData.course.cieEligibilityPercent}%)`}
                    </TableCell>
                    <TableCell className="text-center">
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
        Loading report...
      </div>
    ) : (
      <div className="bg-card text-muted-foreground flex min-h-[200px] items-center justify-center rounded-lg border p-6">
        {emptyMessage}
      </div>
    )}
  </div>
);
