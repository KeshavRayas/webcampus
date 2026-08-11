"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import { AdmissionResponse } from "../admin/admin-admission-columns";
import { ChangeAdmissionModeActions } from "./change-admission-mode-actions";

const baseColumns: ColumnDef<AdmissionResponse>[] = [
  {
    accessorKey: "applicationId",
    header: "Application ID",
    cell: ({ row }) => (
      <div className="font-medium">{row.original.applicationId}</div>
    ),
  },

  {
    id: "name",
    header: "Name",
    cell: ({ row }) => {
      const studentName = row.original.student?.user?.name?.trim();

      const admissionName = row.original.nameAsPer10th?.trim();

      return <div>{studentName || admissionName || "-"}</div>;
    },
  },

  {
    accessorKey: "department",
    header: "Department",
    cell: ({ row }) => row.original.department?.name ?? "-",
  },

  {
    accessorKey: "modeOfAdmission",
    header: "Current Mode",
  },

  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;

      const variant =
        status === "APPROVED"
          ? "default"
          : status === "SUBMITTED"
            ? "secondary"
            : status === "REJECTED"
              ? "destructive"
              : "outline";

      return <Badge variant={variant}>{status}</Badge>;
    },
  },
];

export const getChangeAdmissionModeColumns =
  (): ColumnDef<AdmissionResponse>[] => [
    ...baseColumns,
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <ChangeAdmissionModeActions admission={row.original} />
      ),
    },
  ];
