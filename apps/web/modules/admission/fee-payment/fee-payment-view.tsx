"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { BaseResponse } from "@webcampus/types/api";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import { Loader2 } from "lucide-react";
import React, { useState } from "react";
import { AdmissionResponse } from "../admin/admin-admission-columns";
import { useAdmissionPayment } from "./use-admission-payment";

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

export const FeePaymentView = () => {
  const [payingId, setPayingId] = useState<string | null>(null);
  const { initiatePayment, isProcessing } = useAdmissionPayment();

  const { data: admissions, isLoading } = useQuery({
    queryKey: ["admissions", "fee-payment"],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<AdmissionResponse[]>>(
        "/admission",
        { withCredentials: true }
      );
      if (res.data.status === "success" && Array.isArray(res.data.data)) {
        return res.data.data;
      }
      return [] as AdmissionResponse[];
    },
  });

  const handlePay = async (id: string) => {
    setPayingId(id);
    try {
      await initiatePayment(id);
    } catch {
      // error toast handled by the hook
    } finally {
      setPayingId(null);
    }
  };

  const columns: ColumnDef<AdmissionResponse>[] = [
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
      accessorKey: "applicationId",
      header: "Application ID",
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
        const isPaid = row.original.status === "APPROVED";
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
        const isPaid = admission.status === "APPROVED";

        if (isPaid) {
          return <span className="text-muted-foreground text-sm">-</span>;
        }

        const canPay = admission.status === "SUBMITTED";
        const isPaying = isProcessing && payingId === admission.id;

        return (
          <Button
            size="sm"
            onClick={() => handlePay(admission.id)}
            disabled={!canPay || isPaying}
            title={
              !canPay
                ? "Application must be submitted before payment"
                : undefined
            }
          >
            {isPaying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Pay Now"
            )}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="bg-card text-card-foreground space-y-4 rounded-lg border p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">Fee Payments</h3>
          <p className="text-muted-foreground text-sm">
            Approved admissions are marked as paid. Submit pending applications
            are pending payment and can be marked as paid.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading admissions...
        </div>
      ) : (
        <DataTable columns={columns} data={admissions || []} />
      )}
    </div>
  );
};
