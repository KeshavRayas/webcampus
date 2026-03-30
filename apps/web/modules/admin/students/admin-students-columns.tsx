"use client";

import { ColumnDef } from "@tanstack/react-table";
import { AdminStudentResponseType } from "@webcampus/schemas/admin";
import { AdminStudentActions } from "./admin-students-actions";

const baseColumns: ColumnDef<AdminStudentResponseType>[] = [
  {
    accessorKey: "usn",
    header: "USN",
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => row.original.name ?? "—",
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => row.original.email ?? "—",
  },
  {
    accessorKey: "departmentName",
    header: "Department",
  },
  {
    accessorKey: "currentSemester",
    header: "Semester",
    cell: ({ row }) => {
      const semester = row.original.currentSemester;
      const programType = row.original.programType;

      if (!semester) {
        return "-";
      }

      return programType ? `${programType} - Semester ${semester}` : semester;
    },
  },
];

export const getAdminStudentColumns = (
  showViewDetails: boolean
): ColumnDef<AdminStudentResponseType>[] => [
  ...baseColumns,
  ...(showViewDetails
    ? [
        {
          id: "actions",
          header: "Actions",
          meta: { enableCopy: false },
          cell: ({ row }) => {
            const student = row.original;
            return <AdminStudentActions student={student} />;
          },
        } satisfies ColumnDef<AdminStudentResponseType>,
      ]
    : []),
  {
    id: "menu",
    header: "",
    meta: { enableCopy: false },
    cell: ({ row }) => {
      const student = row.original;
      return <AdminStudentActions student={student} menuOnly />;
    },
  },
];
