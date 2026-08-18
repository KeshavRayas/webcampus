"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import { AdmissionResponse } from "../admin/admin-admission-columns";
import { LeaveCollegeActions } from "./leave-college-actions";

const baseColumns: ColumnDef<AdmissionResponse>[] = [
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
              : status === "PORTED"
                ? "default"
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
