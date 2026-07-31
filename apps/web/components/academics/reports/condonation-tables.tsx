import { Button } from "@webcampus/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { Download, Loader2 } from "lucide-react";
import React from "react";

export interface CondonationStudentData {
  usn: string;
  name: string;
  totalSessions: number;
  presentSessions: number;
  absentSessions: number;
  condonedSessions: number;
  percentageBefore: number;
  percentageAfter: number;
  approvalStatus: string;
  condonationReason?: string;
}

export interface CondonationReportData {
  students: CondonationStudentData[];
  course: {
    code: string;
    name: string;
  };
  semester: {
    semesterNumber: number;
    academicTerm: {
      year: string;
      type: string;
    };
  };
}

interface CondonationReportTableProps {
  reportData?: CondonationReportData;
  isLoading: boolean;
  onDownloadPDF: () => void;
  onDownloadExcel: () => void;
  emptyMessage: string;
}

export const CondonationReportTable: React.FC<CondonationReportTableProps> = ({
  reportData,
  isLoading,
  onDownloadPDF,
  onDownloadExcel,
  emptyMessage,
}) => {
  if (isLoading) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center p-8">
        <Loader2 className="mb-2 h-8 w-8 animate-spin" />
        <p>Loading condonation report...</p>
      </div>
    );
  }

  if (!reportData || reportData.students.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center p-8">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onDownloadExcel}
          className="h-9"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDownloadPDF}
          className="h-9"
        >
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Sl No.</TableHead>
              <TableHead className="w-32">USN</TableHead>
              <TableHead>Student Name</TableHead>
              <TableHead className="text-center">Total Sessions</TableHead>
              <TableHead className="text-center">Present (Actual)</TableHead>
              <TableHead className="text-center">Condoned Added</TableHead>
              <TableHead className="text-center">% Before</TableHead>
              <TableHead className="text-center">% After</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportData.students.map((student, index) => (
              <TableRow key={student.usn}>
                <TableCell className="text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell className="font-medium uppercase">
                  {student.usn}
                </TableCell>
                <TableCell className="capitalize">
                  {student.name.toLowerCase()}
                </TableCell>
                <TableCell className="text-center">
                  {student.totalSessions}
                </TableCell>
                <TableCell className="text-center">
                  {student.presentSessions}
                </TableCell>
                <TableCell className="text-center font-medium text-blue-600">
                  +{student.condonedSessions}
                </TableCell>
                <TableCell className="text-center">
                  {student.percentageBefore}%
                </TableCell>
                <TableCell className="text-center font-bold text-green-600">
                  {student.percentageAfter}%
                </TableCell>
                <TableCell className="text-center">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${student.approvalStatus === "APPROVED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                  >
                    {student.approvalStatus}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
