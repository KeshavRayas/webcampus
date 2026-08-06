"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import { AdmissionResponse } from "../admin/admin-admission-columns";
import { CancelAdmissionActions } from "./cancel-admission-actions";

const nameFor = (admission: AdmissionResponse) => {
  const studentName = admission.student?.user?.name?.trim();
  const admissionName = [
    admission.firstName?.trim(),
    admission.middleName?.trim(),
    admission.lastName?.trim(),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();

  return studentName || admissionName || "-";
};

export const cancelAdmissionColumns: ColumnDef<AdmissionResponse>[] = [
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => nameFor(row.original),
  },
  {
    accessorKey: "primaryEmail",
    header: "Email",
  },
  {
    accessorKey: "modeOfAdmission",
    header: "Admission Mode",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge>{row.original.status}</Badge>,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <CancelAdmissionActions admission={row.original} />,
  },
];
