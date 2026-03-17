"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DepartmentFacultyResponseType } from "@webcampus/schemas/department";

const formatDesignation = (designation: string) => {
  return designation
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
};

export const departmentFacultyColumns: ColumnDef<DepartmentFacultyResponseType>[] =
  [
    {
      accessorKey: "name",
      header: "Faculty Name",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "department",
      header: "Department",
    },
    {
      accessorKey: "designation",
      header: "Designation",
      cell: ({ row }) => {
        return formatDesignation(row.original.designation);
      },
      meta: {
        enableCopy: false,
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created At",
      cell: ({ row }) => {
        return new Date(row.original.createdAt).toLocaleDateString();
      },
      meta: {
        enableCopy: false,
      },
    },
  ];
