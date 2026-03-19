"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DepartmentStudentResponseType } from "@webcampus/schemas/department";

export const departmentStudentColumns: ColumnDef<DepartmentStudentResponseType>[] =
  [
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
      header: "Current Semester",
    },
    {
      accessorKey: "academicYear",
      header: "Academic Year",
    },
    {
      accessorKey: "userId",
      header: "User ID",
      meta: { enableCopy: true },
    },
  ];
