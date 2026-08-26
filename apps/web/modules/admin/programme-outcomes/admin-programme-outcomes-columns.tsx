import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import React from "react";
import { AdminProgrammeOutcomeActions } from "./admin-programme-outcome-actions";
import { ProgrammeOutcomeTableItem } from "./types";

export const adminProgrammeOutcomeColumns: ColumnDef<ProgrammeOutcomeTableItem>[] =
  [
    {
      accessorKey: "programme",
      header: "Programme",
      cell: ({ row }) => {
        const type = row.original.programType;
        const dept = row.original.department;
        return <span>{dept ? `${type} - ${dept.name}` : type}</span>;
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="font-semibold">{row.original.type}</span>
      ),
    },
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-semibold">{row.original.code}</span>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span
          className="block max-w-sm truncate"
          title={row.original.description}
        >
          {row.original.description}
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        return (
          <Badge variant={row.original.isActive ? "default" : "destructive"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <AdminProgrammeOutcomeActions outcome={row.original} />
      ),
    },
  ];
