"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { type AdmissionResponse } from "../admin/admin-admission-columns";

export type FeePaymentResponse = AdmissionResponse;

const getStatusVariant = (status: AdmissionResponse["status"]) => {
  switch (status) {
    case "APPROVED":
      return "default";
    case "SUBMITTED":
      return "secondary";
    case "REJECTED":
      return "destructive";
    default:
      return "outline";
  }
};

type FeePaymentColumnsProps = {
  onShowDetails: (admission: AdmissionResponse) => void;
};

export const createFeePaymentColumns = ({
  onShowDetails,
}: FeePaymentColumnsProps): ColumnDef<AdmissionResponse>[] => [
  {
    id: "studentName",
    header: "Student",
    cell: ({ row }) => {
      const studentName = row.original.student?.user?.name?.trim();
      const admissionName = row.original.nameAsPer10th?.trim();

      return (
        <div>
          <div className="font-medium">
            {studentName || admissionName || "-"}
          </div>
          <div className="text-muted-foreground text-xs">
            {row.original.primaryEmail}
          </div>
        </div>
      );
    },
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
    id: "feeStatus",
    header: "Fee Status",
    cell: ({ row }) => {
      const isPaid = row.original.feeStatus === true;
      return isPaid ? (
        <Badge variant="default">Paid</Badge>
      ) : (
        <Badge variant="secondary">Unpaid</Badge>
      );
    },
  },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) => {
      const admission = row.original;

      return (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="whitespace-nowrap"
            onClick={() => onShowDetails(admission)}
          >
            Details
          </Button>
        </div>
      );
    },
  },
];
