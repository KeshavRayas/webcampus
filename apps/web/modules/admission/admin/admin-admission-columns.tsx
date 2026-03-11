"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import dayjs from "dayjs";
import { AdminAdmissionActions } from "./admin-admission-actions";

export type AdmissionResponse = {
  id: string;
  applicationId: string;
  modeOfAdmission: string;
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";
  createdAt: string;

  // Added all the optional fields from the database
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  gender?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  fatherEmail?: string | null;
  motherEmail?: string | null;
  fatherNumber?: string | null;
  motherNumber?: string | null;
  class10thMarks?: number | null;
  class12thMarks?: number | null;
  class10thMarksPdf?: string | null;
  class12thMarksPdf?: string | null;
  casteCertificate?: string | null;
  class10thSchoolName?: string | null;
  class12thSchoolName?: string | null;
  photo?: string | null;
};

export const AdminAdmissionColumns: ColumnDef<AdmissionResponse>[] = [
  {
    accessorKey: "applicationId",
    header: "Application ID",
    cell: ({ row }) => (
      <div className="font-medium">{row.original.applicationId}</div>
    ),
  },
  {
    accessorKey: "modeOfAdmission",
    header: "Mode",
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
  {
    accessorKey: "createdAt",
    header: "Created On",
    cell: ({ row }) => (
      <div>{dayjs(row.original.createdAt).format("MMM D, YYYY")}</div>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <AdminAdmissionActions admission={row.original} />,
  },
];
