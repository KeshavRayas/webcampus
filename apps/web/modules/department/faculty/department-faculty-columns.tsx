"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DepartmentFacultyResponseType } from "@webcampus/schemas/department";
import { Badge } from "@webcampus/ui/components/badge";

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
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.name}
          {row.original.isHod ? (
            <Badge variant="secondary" className="h-5 py-0 text-xs">
              HOD
            </Badge>
          ) : null}
        </div>
      ),
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
