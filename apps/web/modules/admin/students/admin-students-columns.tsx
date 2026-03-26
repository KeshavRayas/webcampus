"use client";

import { ColumnDef } from "@tanstack/react-table";
import { AdminStudentResponseType } from "@webcampus/schemas/admin";
import { AdminStudentActions } from "./admin-students-actions";

export const adminStudentColumns: ColumnDef<AdminStudentResponseType>[] = [
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
  },
  {
    id: "actions",
    meta: { enableCopy: false },
    cell: ({ row }) => {
      const student = row.original;
      return <AdminStudentActions student={student} />;
    },
  },
];
