"use client";

import { authClient } from "@/lib/auth-client";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { Checkbox } from "@webcampus/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@webcampus/ui/components/dialog";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CheckCircle2, Eye, FileDown, Loader2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAdmissionReview } from "../admin/use-admission-review";
import { FeePaymentResponse } from "./fee-payment-columns";
import { useFeePayment } from "./use-fee-payment";

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

export const FeePaymentActions = ({
  admission,
}: {
  admission: FeePaymentResponse;
}) => {
  const { data: session } = authClient.useSession();
  const role = session?.user?.role;
  const canManage =
    role === "admin" || role === "super_admin" || role === "admission";

  const { onApprove, onReject, isApproving, isRejecting } =
    useAdmissionReview();
  const { recordPayment, isRecording } = useFeePayment();

  const [recordOpen, setRecordOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [feePaid, setFeePaid] = useState(
    admission.feePaid != null ? String(admission.feePaid) : ""
  );
  const [feeReceiptNumber, setFeeReceiptNumber] = useState(
    admission.feeReceiptNumber ?? ""
  );
  const [scholarship, setScholarship] = useState(
    Boolean(admission.scholarship)
  );
  const [sspId, setSspId] = useState(admission.sspId ?? "");

  const fullName = useMemo(() => getFullName(admission), [admission]);

  useEffect(() => {
    setFeePaid(admission.feePaid != null ? String(admission.feePaid) : "");
    setFeeReceiptNumber(admission.feeReceiptNumber ?? "");
    setScholarship(Boolean(admission.scholarship));
    setSspId(admission.sspId ?? "");
  }, [admission]);

  const handleRecordPayment = () => {
    if (feePaid === "" || Number.isNaN(Number(feePaid))) {
      return;
    }

    recordPayment(
      {
        id: admission.id,
        data: {
          feePaid: Number(feePaid),
          feeReceiptNumber: feeReceiptNumber || undefined,
          scholarship,
          sspId: scholarship ? sspId || undefined : undefined,
        },
      },
      {
        onSuccess: () => setRecordOpen(false),
      }
    );
  };

  const generateReceiptPdf = () => {
    const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const margin = 48;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(
      "B.M.S. College of Engineering",
      doc.internal.pageSize.getWidth() / 2,
      56,
      {
        align: "center",
      }
    );

    doc.setFontSize(12);
    doc.text(
      "Admission Fee Receipt",
      doc.internal.pageSize.getWidth() / 2,
      76,
      {
        align: "center",
      }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generated on ${new Date().toLocaleString()}`, margin, 96);
    doc.text(`Application ID: ${admission.applicationId || "-"}`, margin, 110);

    autoTable(doc, {
      startY: 130,
      head: [["Field", "Details"]],
      body: [
        ["Student Name", fullName],
        ["College Email", admission.primaryEmail || "-"],
        [
          "Semester",
          admission.semester
            ? `${admission.semester.programType} - Semester ${admission.semester.semesterNumber}`
            : "-",
        ],
        ["Department", admission.department?.name ?? "-"],
        ["Mode of Admission", admission.modeOfAdmission || "-"],
        [
          "Fee Paid",
          admission.feePaid != null ? `₹${admission.feePaid}` : "Not paid",
        ],
        ["Receipt Number", admission.feeReceiptNumber || "-"],
        ["Scholarship", admission.scholarship ? "Yes" : "No"],
        ["Approval Status", admission.status],
      ],
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: {
        fillColor: [55, 65, 81],
        textColor: 255,
        fontStyle: "bold",
      },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 170 },
        1: { cellWidth: 325 },
      },
    });

    doc.save(`fee-receipt-${admission.applicationId || "application"}.pdf`);
  };

  const isSubmitted = admission.status === "SUBMITTED";
  const isApproved = admission.status === "APPROVED";

  return (
    <div className="flex items-center gap-1">
      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            Record Payment
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Fee Payment</DialogTitle>
            <DialogDescription>
              {admission.applicationId || admission.primaryEmail}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fee-payment-amount">Fee Paid (₹) *</Label>
              <Input
                id="fee-payment-amount"
                type="number"
                min="0"
                value={feePaid}
                onChange={(e) => setFeePaid(e.target.value)}
                placeholder="Enter amount"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fee-payment-receipt">Fee Receipt Number</Label>
              <Input
                id="fee-payment-receipt"
                value={feeReceiptNumber}
                onChange={(e) => setFeeReceiptNumber(e.target.value)}
                placeholder="Enter receipt number"
              />
            </div>

            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Checkbox
                id="fee-payment-scholarship"
                checked={scholarship}
                onCheckedChange={(checked) => setScholarship(Boolean(checked))}
              />
              <Label
                htmlFor="fee-payment-scholarship"
                className="cursor-pointer text-sm font-medium"
              >
                Receiving scholarship
              </Label>
            </div>

            {scholarship && (
              <div className="space-y-2">
                <Label htmlFor="fee-payment-ssp">SSP ID *</Label>
                <Input
                  id="fee-payment-ssp"
                  value={sspId}
                  onChange={(e) => setSspId(e.target.value)}
                  placeholder="Enter SSP ID"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={isRecording || feePaid === ""}
            >
              {isRecording ? "Saving..." : "Save Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Eye className="mr-1 h-4 w-4" />
            Details
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fee Payment Details</DialogTitle>
            <DialogDescription>
              {admission.applicationId || admission.primaryEmail}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm">Student Name</p>
              <p className="font-medium">{fullName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">College Email</p>
              <p className="break-all font-medium">{admission.primaryEmail}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Fee Paid</p>
              <p className="font-medium">
                {admission.feePaid != null
                  ? `₹${admission.feePaid}`
                  : "Not paid"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Receipt Number</p>
              <p className="font-medium">{admission.feeReceiptNumber || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Scholarship</p>
              <p className="font-medium">
                {admission.scholarship ? "Yes" : "No"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Status</p>
              <Badge variant={getStatusVariant(admission.status)}>
                {admission.status}
              </Badge>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={generateReceiptPdf}>
              <FileDown className="mr-2 h-4 w-4" />
              Download Receipt PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canManage && isSubmitted && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="text-green-600"
            onClick={() => onApprove(admission.id)}
            disabled={isApproving || isRejecting}
          >
            {isApproving ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 h-4 w-4" />
            )}
            Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600"
            onClick={() => onReject(admission.id)}
            disabled={isApproving || isRejecting}
          >
            {isRejecting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-1 h-4 w-4" />
            )}
            Reject
          </Button>
        </>
      )}

      {canManage && isApproved && <Badge variant="default">Approved</Badge>}
    </div>
  );
};
