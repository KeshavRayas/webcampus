"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import { AdmissionResponse } from "../admin/admin-admission-columns";
import { LeaveCollegeActions } from "./leave-college-actions";

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

      const admissionName = [
        row.original.firstName?.trim(),
        row.original.middleName?.trim(),
        row.original.lastName?.trim(),
      ]
        .filter((v): v is string => Boolean(v))
        .join(" ")
        .trim();

      return <div>{studentName || admissionName || "-"}</div>;
    },
  },
  {
    accessorKey: "department",
    header: "Department",
    cell: ({ row }) => <div>{row.original.department?.name ?? "-"}</div>,
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

export const getLeaveCollegeColumns = (): ColumnDef<AdmissionResponse>[] => [
  ...baseColumns,
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }: { row: { original: AdmissionResponse } }) => (
      <LeaveCollegeActions admission={row.original} />
    ),
  },
];
