"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { dayjs } from "@webcampus/common/dayjs";
import { FacultyAttendanceSessionDetailDTO } from "@webcampus/types/api";
import { Badge } from "@webcampus/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { useMemo } from "react";

type StudentRow = {
  studentId: string;
  usn: string;
  name: string;
  status: "PRESENT" | "ABSENT" | null;
};

type SessionDetailModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  sessionDetails: Record<string, FacultyAttendanceSessionDetailDTO>;
};

export const SessionDetailModal = ({
  isOpen,
  onOpenChange,
  sessionId,
  sessionDetails,
}: SessionDetailModalProps) => {
  const sessionData = sessionId ? sessionDetails[sessionId] : null;

  const studentRows = useMemo(() => {
    if (!sessionData) return [];
    return sessionData.students.map((student) => ({
      studentId: student.studentId,
      usn: student.usn,
      name: student.name,
      status: student.status,
    }));
  }, [sessionData?.students]);

  const columns = useMemo<ColumnDef<StudentRow>[]>(
    () => [
      {
        accessorKey: "usn",
        header: "USN",
        cell: ({ row }) => (
          <span className="font-mono text-xs tracking-wide">
            {row.original.usn}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Student Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Attendance",
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge
              variant={status === "PRESENT" ? "default" : "destructive"}
              className="min-w-[70px] justify-center"
            >
              {status === "PRESENT" ? "Present" : "Absent"}
            </Badge>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: studentRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const presentCount = useMemo(() => {
    return studentRows.filter((s) => s.status === "PRESENT").length;
  }, [studentRows]);

  const absentCount = useMemo(() => {
    return studentRows.filter((s) => s.status === "ABSENT").length;
  }, [studentRows]);

  const totalStudents = studentRows.length;

  if (!sessionId || !sessionData) {
    return null;
  }

  const formattedDate = dayjs(sessionData.session.sessionDate).format(
    "MMM D, YYYY"
  );
  const formattedTime = sessionData.session.timingLabel;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[96vw] max-w-[96vw] flex-col sm:w-[94vw] sm:max-w-5xl lg:max-w-6xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-center text-xl">
            Attendance Details
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {formattedDate} | {formattedTime}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/20 mx-6 mt-4 grid shrink-0 grid-cols-1 gap-3 rounded-lg border p-4 text-sm md:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Course:</span>{" "}
            {sessionData.session.courseCode} - {sessionData.session.courseName}
          </p>
          <p>
            <span className="text-muted-foreground">Section:</span>{" "}
            {sessionData.session.sectionName}
          </p>
          <p>
            <span className="text-muted-foreground">Date:</span> {formattedDate}
          </p>
          <p>
            <span className="text-muted-foreground">Time Slot:</span>{" "}
            {formattedTime}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <div className="rounded-xl border">
            <Table>
              <TableHeader className="bg-background sticky top-0">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="text-left font-semibold"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="h-12"
                    >
                      {row.getVisibleCells().map((cell) => {
                        return (
                          <TableCell key={cell.id} className="py-3">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No student records found for this session.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="bg-background flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-6 py-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-700">
              Present: {presentCount}
            </span>
            <span className="rounded-md bg-rose-500/10 px-2 py-1 text-rose-700">
              Absent: {absentCount}
            </span>
            <span className="bg-muted text-muted-foreground rounded-md px-2 py-1">
              Total: {totalStudents}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
