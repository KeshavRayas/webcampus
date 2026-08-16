"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import {
  AdmissionResponse,
  getAdmissionFullName,
} from "../admin/admin-admission-columns";
import { CancelAdmissionActions } from "./cancel-admission-actions";

const formatDate = (value: string | undefined | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const cancelAdmissionColumns: ColumnDef<AdmissionResponse>[] = [
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="font-medium">{getAdmissionFullName(row.original)}</div>
    ),
  },
  {
    accessorKey: "primaryEmail",
    header: "Email",
  },
  {
    id: "createdOn",
    header: "Created On",
    cell: ({ row }) => (
      <div suppressHydrationWarning>{formatDate(row.original.createdAt)}</div>
    ),
  },
  {
    id: "cancelledOn",
    header: "Cancelled On",
    cell: ({ row }) => (
      <div suppressHydrationWarning>
        {formatDate(row.original.cancellation?.cancelledAt)}
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;

      const variant =
        status === "APPROVED"
          ? "default"
          : status === "SUBMITTED"
            ? "secondary"
            : status === "CANCELLED"
              ? "destructive"
              : "outline";

      return <Badge variant={variant}>{status}</Badge>;
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <CancelAdmissionActions admission={row.original} />,
  },
];
