"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DepartmentStudentResponseType } from "@webcampus/schemas/department";

const formatStatus = (status: string) => {
  return status.charAt(0) + status.slice(1).toLowerCase();
};

export const departmentStudentColumns: ColumnDef<DepartmentStudentResponseType>[] =
  [
    {
      accessorKey: "applicationId",
      header: "Application ID",
    },
    {
      accessorKey: "tempUsn",
      header: "Temp USN",
      cell: ({ row }) => row.original.tempUsn ?? "—",
    },
    {
      id: "fullName",
      header: "Full Name",
      cell: ({ row }) => {
        const { firstName, lastName } = row.original;
        const name = [firstName, lastName].filter(Boolean).join(" ");
        return name || "—";
      },
    },
    {
      accessorKey: "branch",
      header: "Branch",
      cell: ({ row }) => row.original.branch ?? "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => formatStatus(row.original.status),
      meta: {
        enableCopy: false,
      },
    },
    {
      accessorKey: "modeOfAdmission",
      header: "Mode of Admission",
    },
    {
      accessorKey: "gender",
      header: "Gender",
      cell: ({ row }) => row.original.gender ?? "—",
    },
    {
      accessorKey: "primaryEmail",
      header: "Primary Email",
      cell: ({ row }) => row.original.primaryEmail ?? "—",
    },
  ];
