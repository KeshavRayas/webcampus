"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import { FeePaymentActions } from "./fee-payment-actions";

export type FeePaymentResponse = {
  id: string;
  applicationId: string;
  modeOfAdmission: string;
  status:
    | "PENDING"
    | "SUBMITTED"
    | "APPROVED"
    | "REJECTED"
    | "EXITED"
    | "CANCELLED";
  createdAt: string;
  primaryEmail: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  feePaid?: number | null;
  feeReceiptNumber?: string | null;
  scholarship?: boolean | null;
  sspId?: string | null;
  department?: { name: string } | null;
  semester?: {
    semesterNumber: number;
    programType: string;
    academicTerm?: {
      type: string;
      year: string;
    };
  } | null;
  student?: {
    usn: string;
    user: {
      name: string;
    };
  } | null;
};

const getStatusVariant = (status: FeePaymentResponse["status"]) => {
  switch (status) {
    case "APPROVED":
      return "default" as const;
    case "SUBMITTED":
      return "secondary" as const;
    case "REJECTED":
      return "destructive" as const;
    case "EXITED":
      return "outline" as const;
    case "CANCELLED":
      return "outline" as const;
    default:
      return "outline" as const;
  }
};

const getFullName = (admission: FeePaymentResponse) => {
  const studentName = admission.student?.user?.name?.trim();
  const admissionName = [
    admission.firstName,
    admission.middleName,
    admission.lastName,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");

  return studentName || admissionName || "-";
};

export const feePaymentColumns: ColumnDef<FeePaymentResponse>[] = [
  {
    accessorKey: "applicationId",
    header: "Application ID",
    cell: ({ row }) => (
      <div className="font-medium">{row.original.applicationId || "-"}</div>
    ),
  },
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => <div>{getFullName(row.original)}</div>,
  },
  {
    accessorKey: "primaryEmail",
    header: "College Email",
    cell: ({ row }) => (
      <div className="text-muted-foreground">{row.original.primaryEmail}</div>
    ),
  },
  {
    accessorKey: "feePaid",
    header: "Fee Paid (₹)",
    cell: ({ row }) => {
      const feePaid = row.original.feePaid;
      return (
        <div className={feePaid ? "font-semibold" : "text-muted-foreground"}>
          {feePaid != null ? `₹${feePaid}` : "Not paid"}
        </div>
      );
    },
  },
  {
    accessorKey: "feeReceiptNumber",
    header: "Receipt No.",
    cell: ({ row }) => <div>{row.original.feeReceiptNumber || "-"}</div>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={getStatusVariant(row.original.status)}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <FeePaymentActions admission={row.original} />,
  },
];
