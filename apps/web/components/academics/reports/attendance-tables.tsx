"use client";

import type { DetailedReportData } from "@/modules/faculty/attendance/attendance-report-types";
import { dayjs } from "@webcampus/common/dayjs";
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

type SessionWithCounts = {
  id: string;
  sessionDate: string;
  courseCode: string;
  courseName: string;
  sectionName: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  percentage: number;
};

const getEligibilityStatus = (
  percentage: number,
  condonationStatus: string
): "Eligible" | "Not Eligible" => {
  if (percentage >= 85) return "Eligible";
  if (percentage >= 75 && condonationStatus === "APPROVED") return "Eligible";
  return "Not Eligible";
};

const formatCondonationStatus = (status: string): string => {
  switch (status) {
    case "NOT_REQUESTED":
      return "Not Requested";
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
};

export const AttendanceStatusTable = ({
  statusReportData,
  isErrorSessions,
  errorSessions,
  onSessionSelect,
  emptyMessage,
}: {
  statusReportData: SessionWithCounts[];
  isErrorSessions: boolean;
  errorSessions: unknown;
  onSessionSelect: (sessionId: string) => void;
  emptyMessage: string;
}) => (
  <>
    {isErrorSessions && (
      <div className="text-destructive border-destructive/20 bg-destructive/5 rounded-lg border p-4 text-sm">
        {errorSessions instanceof Error
          ? errorSessions.message
          : "Failed to load attendance sessions"}
      </div>
    )}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date of Session</TableHead>
          <TableHead>Total Students</TableHead>
          <TableHead>Present Students</TableHead>
          <TableHead>Absent Students</TableHead>
          <TableHead>Class % PER.</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {statusReportData.length > 0 ? (
          statusReportData.map((session) => (
            <TableRow key={session.id}>
              <TableCell>
                {session.sessionDate
                  ? dayjs(session.sessionDate).format("MMM D, YYYY")
                  : "-"}
              </TableCell>
              <TableCell>{session.totalStudents}</TableCell>
              <TableCell>
                <Badge variant="default" className="bg-green-500">
                  {session.presentCount}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="destructive">{session.absentCount}</Badge>
              </TableCell>
              <TableCell className="font-medium">
                {session.percentage}%
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSessionSelect(session.id)}
                >
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={6}
              className="text-muted-foreground h-24 text-center"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  </>
);

export const AttendanceDetailedTable = ({
  detailedReportData,
  isLoadingDetailed,
  onDownloadDetailedPDF,
  onDownloadDetailedExcel,
  emptyMessage,
}: {
  detailedReportData?: DetailedReportData;
  isLoadingDetailed?: boolean;
  onDownloadDetailedPDF?: () => void;
  onDownloadDetailedExcel?: () => void;
  emptyMessage: string;
}) => (
  <div className="space-y-4">
    {detailedReportData && detailedReportData.students.length > 0 ? (
      <>
        <div className="flex justify-end gap-2">
          {onDownloadDetailedExcel && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadDetailedExcel}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download Excel
            </Button>
          )}
          {onDownloadDetailedPDF && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadDetailedPDF}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-background min-w-25 sticky left-0 z-10">
                  USN
                </TableHead>
                <TableHead className="bg-background left-25 min-w-37.5 sticky z-10">
                  Student Name
                </TableHead>
                {detailedReportData.sessions.map((session) => (
                  <TableHead
                    key={session.id}
                    className="min-w-20 whitespace-nowrap text-center"
                  >
                    {dayjs(session.sessionDate).format("MMM D")}
                  </TableHead>
                ))}
                <TableHead className="min-w-20 text-center">
                  Total Session
                </TableHead>
                <TableHead className="min-w-25 text-center">
                  Condonation
                </TableHead>
                <TableHead className="min-w-20 text-center">Present</TableHead>
                <TableHead className="min-w-20 text-center">Absent</TableHead>
                <TableHead className="min-w-20 text-center">
                  Percentage %
                </TableHead>
                <TableHead className="min-w-25 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailedReportData.students.map((student) => {
                const status = getEligibilityStatus(
                  student.percentage,
                  student.condonationStatus
                );
                return (
                  <TableRow key={student.studentId}>
                    <TableCell className="bg-background sticky left-0 z-10 font-mono text-sm">
                      {student.usn}
                    </TableCell>
                    <TableCell className="bg-background left-25 sticky z-10 font-medium">
                      {student.name}
                    </TableCell>
                    {student.sessionStatuses.map((sessionStatus, idx) => (
                      <TableCell
                        key={idx}
                        className={cn(
                          "text-center font-medium",
                          sessionStatus === "PRESENT"
                            ? "text-emerald-600 dark:text-emerald-500"
                            : "text-rose-600 dark:text-rose-500"
                        )}
                      >
                        {sessionStatus === "PRESENT" ? "P" : "A"}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-medium">
                      {student.totalSessions}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          student.condonationStatus === "APPROVED"
                            ? "default"
                            : student.condonationStatus === "PENDING"
                              ? "outline"
                              : student.condonationStatus === "REJECTED"
                                ? "destructive"
                                : "secondary"
                        }
                        className="text-xs"
                      >
                        {formatCondonationStatus(student.condonationStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-500">
                      {student.presentSessions}
                    </TableCell>
                    <TableCell className="text-center font-medium text-rose-600 dark:text-rose-500">
                      {student.absentSessions}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {student.percentage}%
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          status === "Eligible" ? "default" : "destructive"
                        }
                        className={cn(
                          status === "Eligible" &&
                            "border-transparent bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                        )}
                      >
                        {status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </>
    ) : isLoadingDetailed ? (
      <div className="text-muted-foreground min-h-50 flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading detailed report...
      </div>
    ) : (
      <div className="text-muted-foreground min-h-50 flex items-center justify-center">
        {emptyMessage}
      </div>
    )}
  </div>
);

export const AttendancePercentageTable = ({
  percentageReportData,
  onDownloadPercentagePDF,
  onDownloadPercentageExcel,
  emptyMessage,
}: {
  percentageReportData?: DetailedReportData;
  onDownloadPercentagePDF?: () => void;
  onDownloadPercentageExcel?: () => void;
  emptyMessage: string;
}) => (
  <div className="space-y-4">
    {percentageReportData && percentageReportData.students.length > 0 ? (
      <>
        <div className="flex justify-end gap-2">
          {onDownloadPercentageExcel && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadPercentageExcel}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download Excel
            </Button>
          )}
          {onDownloadPercentagePDF && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadPercentagePDF}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-background min-w-25 sticky left-0 z-10">
                  USN
                </TableHead>
                <TableHead className="bg-background left-25 min-w-37.5 sticky z-10">
                  Student Name
                </TableHead>
                <TableHead className="min-w-25 text-center">
                  Total Sessions
                </TableHead>
                <TableHead className="min-w-30 text-center">
                  Condonation
                </TableHead>
                <TableHead className="min-w-25 text-center">
                  Present Sessions
                </TableHead>
                <TableHead className="min-w-25 text-center">
                  Absent Sessions
                </TableHead>
                <TableHead className="min-w-25 text-center">
                  % Percentage
                </TableHead>
                <TableHead className="min-w-25 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {percentageReportData.students.map((student) => {
                const status = getEligibilityStatus(
                  student.percentage,
                  student.condonationStatus
                );
                const condonationLabel =
                  student.condonationStatus === "APPROVED"
                    ? "Condoned"
                    : "Not Condoned";
                return (
                  <TableRow key={student.studentId}>
                    <TableCell className="bg-background sticky left-0 z-10 font-mono text-sm">
                      {student.usn}
                    </TableCell>
                    <TableCell className="bg-background left-25 sticky z-10 font-medium">
                      {student.name}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {student.totalSessions}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          student.condonationStatus === "APPROVED"
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {condonationLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-500">
                      {student.presentSessions}
                    </TableCell>
                    <TableCell className="text-center font-medium text-rose-600 dark:text-rose-500">
                      {student.absentSessions}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {student.percentage}%
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          status === "Eligible" ? "default" : "destructive"
                        }
                        className={cn(
                          status === "Eligible" &&
                            "border-transparent bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                        )}
                      >
                        {status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </>
    ) : !percentageReportData || percentageReportData.students.length === 0 ? (
      <div className="text-muted-foreground min-h-50 flex items-center justify-center">
        {emptyMessage}
      </div>
    ) : null}
  </div>
);
