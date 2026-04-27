"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { dayjs } from "@webcampus/common/dayjs";
import { Button } from "@webcampus/ui/components/button";
import { Skeleton } from "@webcampus/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { useMemo } from "react";
import { DataTablePagination } from "./data-table-pagination";

type SessionWithCounts = {
  id: string;
  sessionDate: string;
  timingLabel: string;
  timingStartTime: string;
  timingEndTime: string;
  courseCode: string;
  courseName: string;
  sectionName: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  percentage: number;
  createdAt: string;
};

type StatusReportProps = {
  sessions: SessionWithCounts[];
  isLoading: boolean;
  onSessionSelect: (sessionId: string) => void;
};

export const StatusReport = ({
  sessions,
  isLoading,
  onSessionSelect,
}: StatusReportProps) => {
  // Define columns
  const columns = useMemo<ColumnDef<SessionWithCounts>[]>(
    () => [
      {
        accessorKey: "sessionDate",
        header: "Date of Session",
        cell: ({ row: { original } }) => {
          const date = dayjs(original.sessionDate);
          return date.format("MMM D, YYYY");
        },
      },
      {
        accessorKey: "totalStudents",
        header: "Total Students",
        cell: ({ row: { original } }) => original.totalStudents.toString(),
      },
      {
        accessorKey: "presentCount",
        header: "Present Students",
        cell: ({ row: { original } }) => original.presentCount.toString(),
      },
      {
        accessorKey: "absentCount",
        header: "Absent Students",
        cell: ({ row: { original } }) => original.absentCount.toString(),
      },
      {
        accessorKey: "percentage",
        header: "Class % PER.",
        cell: ({ row: { original } }) => {
          return `${original.percentage}%`;
        },
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row: { original } }) => (
          <Button
            variant="outline"
            size="icon"
            onClick={() => onSessionSelect(original.id)}
            aria-label="View session details"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12h.01" />
              <path d="M12 8v.01" />
              <path d="M16 12h.01" />
              <path d="M12 16v.01" />
            </svg>
          </Button>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: sessions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((__, colIndex) => (
                  <TableCell key={colIndex} className="h-16">
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <DataTablePagination table={table} isLoading={isLoading} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
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
              >
                {row.getVisibleCells().map((cell) => {
                  return (
                    <TableCell
                      key={cell.id}
                      className={
                        cell.column.columnDef.id === "action"
                          ? "relative"
                          : "relative"
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                      {cell.column.columnDef.id === "action" && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-end pr-2 opacity-0 transition-all duration-200 ease-in-out group-hover:opacity-100">
                          {/* The button is already in the cell content */}
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No sessions found for selected filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <DataTablePagination table={table} isLoading={isLoading} />
    </div>
  );
};
