"use client";

import { apiClient } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAdmissionDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import { admissionModes, admissionTypes } from "@webcampus/schemas/constants";
import { BaseResponse } from "@webcampus/types/api";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  FilterActions,
  FilterBuilder,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileDown, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { ApplicantAdmissionView } from "../applicant/applicant-admission-view";
import { type FeePaymentResponse } from "./fee-payment-columns";
import { useAdmissionPayment } from "./use-admission-payment";

const ADMISSION_STATUSES = [
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;
const ALL_FILTERS_VALUE = "__all__";

type FeePaymentFilters = {
  academicTerm: string;
  semester: string;
  applicationId: string;
  status: string;
  mode: string;
  admissionType: string;
  createdFrom: string;
  createdTo: string;
};

const EMPTY_FILTERS: FeePaymentFilters = {
  academicTerm: "",
  semester: "",
  applicationId: "",
  status: "",
  mode: "",
  admissionType: "",
  createdFrom: "",
  createdTo: "",
};

const buildFeePaymentSummary = (admissions: FeePaymentResponse[]) => {
  const paid = admissions.filter(
    (admission) => (admission.feePaid ?? 0) > 0
  ).length;
  const unpaid = admissions.length - paid;
  const approved = admissions.filter(
    (admission) => admission.status === "APPROVED"
  ).length;
  const pending = admissions.filter(
    (admission) =>
      admission.status === "PENDING" || admission.status === "SUBMITTED"
  ).length;

  return { total: admissions.length, paid, unpaid, approved, pending };
};

const getFullName = (admission: FeePaymentResponse) => {
  const studentName = admission.student?.user?.name?.trim();
  const admissionName = [
    admission.firstName,
    admission.middleName,
    admission.lastName,
    admission.nameAsPer10th,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");

  return studentName || admissionName || "-";
};

const RUPEES_TEXT = (() => {
  const underTwenty = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const twoDigits = (n: number): string =>
    n < 20
      ? (underTwenty[n] ?? "")
      : tens[Math.floor(n / 10)] +
        (n % 10 ? " " + (underTwenty[n % 10] ?? "") : "");
  const withinHundred = (n: number): string =>
    n < 100
      ? twoDigits(n)
      : underTwenty[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 ? " " + twoDigits(n % 100) : "");
  return (value: number): string => {
    if (!Number.isFinite(value) || value < 0) return "";
    let n = Math.floor(Math.abs(value));
    if (n === 0) return "Rupees Zero Only";
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thousand = Math.floor(n / 1000);
    n %= 1000;
    let words = "";
    if (crore) words += " " + withinHundred(crore) + " Crore";
    if (lakh) words += " " + withinHundred(lakh) + " Lakh";
    if (thousand) words += " " + withinHundred(thousand) + " Thousand";
    if (n) words += " " + withinHundred(n);
    return "Rupees" + words + " Only";
  };
})();

export const FeePaymentView = () => {
  const { data: session } = authClient.useSession();
  const role = session?.user?.role;
  const isApplicant = role === "applicant";

  if (isApplicant) {
    return <ApplicantAdmissionView initialStep="payment" />;
  }

  return <FeePaymentStaffView />;
};

const FeePaymentStaffView = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialFilters = getFiltersFromSearchParams(
    searchParams,
    EMPTY_FILTERS
  );

  const [draftFilters, setDraftFilters] =
    useState<FeePaymentFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FeePaymentFilters>(initialFilters);
  const [selectedAdmission, setSelectedAdmission] =
    useState<FeePaymentResponse | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const { initiatePayment, isProcessing } = useAdmissionPayment();

  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];
  const { data: departments = [] } = useAdmissionDepartments();
  const selectedTerm = terms.find((t) => t.id === draftFilters.academicTerm);
  const nestedSemesters = selectedTerm?.Semester || [];

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: nestedSemesters,
    departments,
  });

  const updateDraftFilter = (key: keyof FeePaymentFilters, value: string) => {
    if (key === "academicTerm") {
      setDraftFilters((current) => ({
        ...current,
        academicTerm: value,
        semester: "",
      }));
      return;
    }

    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const filterFields: FilterFieldConfig<FeePaymentFilters>[] = [
    {
      key: "academicTerm",
      label: "Academic Term",
      type: "select",
      placeholder: "All terms",
      allOptionLabel: "All terms",
      options: terms.map((term) => ({
        label: `${term.type} ${term.year}`,
        value: term.id,
      })),
    },
    {
      key: "semester",
      label: "Semester",
      type: "select",
      placeholder: draftFilters.academicTerm
        ? "All semesters"
        : "Select term first",
      allOptionLabel: "All semesters",
      options: nestedSemesters.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: semester.id,
      })),
    },
    {
      key: "applicationId",
      label: "Application ID",
      type: "text",
      placeholder: "Search application ID",
      inputId: "fee-payment-application-id",
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      placeholder: "All statuses",
      allOptionLabel: "All statuses",
      options: ADMISSION_STATUSES.map((status) => ({
        label: status,
        value: status,
      })),
    },
    {
      key: "mode",
      label: "Mode",
      type: "select",
      placeholder: "All modes",
      allOptionLabel: "All modes",
      options: admissionModes.map((mode) => ({ label: mode, value: mode })),
    },
    {
      key: "admissionType",
      label: "Admission Type",
      type: "select",
      placeholder: "All admission types",
      allOptionLabel: "All admission types",
      options: admissionTypes.map((type) => ({
        label: type.label,
        value: type.value,
      })),
    },
    {
      key: "createdFrom",
      label: "Created From",
      type: "date",
      inputId: "fee-payment-created-from",
      className: "xl:col-start-1",
    },
    {
      key: "createdTo",
      label: "Created To",
      type: "date",
      inputId: "fee-payment-created-to",
      className: "xl:col-start-2",
    },
  ];

  const query = createFilterQueryString(appliedFilters);
  const { data, isFetching, isLoading } = useQuery({
    queryKey: ["fee-payments", appliedFilters],
    queryFn: async () => {
      const response = await apiClient.get<BaseResponse<FeePaymentResponse[]>>(
        `/admission${query ? `?${query}` : ""}`,
        { withCredentials: true }
      );
      if (response.data.status === "error") {
        throw new Error(response.data.message);
      }
      return response.data.data ?? [];
    },
  });

  const admissions = data ?? [];

  const summary = useMemo(
    () => buildFeePaymentSummary(admissions),
    [admissions]
  );

  const applyFilters = () => {
    if (
      draftFilters.createdFrom &&
      draftFilters.createdTo &&
      new Date(draftFilters.createdFrom) > new Date(draftFilters.createdTo)
    ) {
      toast.error("Created from date must be before created to date.");
      return;
    }

    setAppliedFilters(draftFilters);
    const filterQuery = createFilterQueryString(draftFilters);
    router.replace(`${pathname}${filterQuery ? `?${filterQuery}` : ""}`, {
      scroll: false,
    });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    router.replace(pathname, { scroll: false });
  };

  const generateReportPdf = () => {
    if (admissions.length === 0) {
      toast.error("No admissions to include in the report.");
      return;
    }

    const doc = new jsPDF({ orientation: "l", unit: "pt", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Admission Fee Payment Report", 48, 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 48, 60);
    doc.text(
      `Total records: ${summary.total} | Paid: ${summary.paid} | Unpaid: ${summary.unpaid} | Approved: ${summary.approved} | Pending Review: ${summary.pending}`,
      48,
      74
    );

    autoTable(doc, {
      startY: 90,
      head: [
        [
          "Application ID",
          "Name",
          "Email",
          "Fee Paid (₹)",
          "Receipt No.",
          "Status",
          "Mode",
        ],
      ],
      body: admissions.map((admission) => [
        admission.applicationId || "-",
        getFullName(admission),
        admission.primaryEmail,
        admission.feePaid != null ? String(admission.feePaid) : "Not paid",
        admission.feeReceiptNumber || "-",
        admission.status,
        admission.modeOfAdmission || "-",
      ]),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: {
        fillColor: [55, 65, 81],
        textColor: 255,
        fontStyle: "bold",
      },
      margin: { left: 48, right: 48 },
    });

    doc.save(`fee-payment-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const generateReceiptPdf = (admission: FeePaymentResponse) => {
    if (!admission) {
      toast.error("No student details available for receipt.");
      return;
    }

    const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const W = 595;
    const margin = 42;
    const rightEdge = W - margin;
    const contentWidth = rightEdge - margin;
    const brand: [number, number, number] = [106, 162, 224];
    const brandDark: [number, number, number] = [41, 74, 138];
    const ink: [number, number, number] = [17, 24, 39];
    const muted: [number, number, number] = [100, 116, 139];
    const line: [number, number, number] = [203, 213, 225];
    const tint: [number, number, number] = [231, 240, 250];

    const name = getFullName(admission);
    const usn = admission.student?.usn || "-";
    const contact = admission.primaryPhoneNumber || "-";
    const branch = admission.department?.name || "-";
    const year = "-";
    const quota = admission.quota || admission.categoryAllotted || "-";
    const academicYear = "-";
    const totalAmount = admission.feePaid;
    const hasAmount =
      typeof totalAmount === "number" && Number.isFinite(totalAmount);
    const amountText = hasAmount ? totalAmount.toLocaleString("en-IN") : "-";
    const amountInWords = hasAmount ? RUPEES_TEXT(totalAmount) : "-";
    const receiptNo = admission.feeReceiptNumber || "-";
    const receiptDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const transactionId = "-";
    const transactionDate = "-";
    const remark = "-";

    let y = 46;

    const headingText = (text: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
      doc.text(text.toUpperCase(), margin, y);
      doc.setDrawColor(brand[0], brand[1], brand[2]);
      doc.setLineWidth(1);
      doc.line(margin, y + 5, rightEdge, y + 5);
      y += 20;
    };

    // ---- Header: college + PAID badge ----
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.text("BMS COLLEGE OF ENGINEERING", margin, 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(
      "Affiliated to VTU  •  Approved by AICTE  •  ESTD. 1946",
      margin,
      58
    );
    doc.text(
      "P.O. Box No. 1908, Bull Temple Road, Basavanagudi, Bengaluru - 560019",
      margin,
      70
    );
    doc.text("www.bmsec.com  •  college@bmsec.com", margin, 82);

    doc.setFillColor(tint[0], tint[1], tint[2]);
    doc.setDrawColor(brand[0], brand[1], brand[2]);
    doc.setLineWidth(0.8);
    doc.roundedRect(rightEdge - 92, 38, 92, 30, 5, 5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(brand[0], brand[1], brand[2]);
    doc.text("PAID", rightEdge - 46, 55, { align: "center" });

    // divider
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.setLineWidth(0.6);
    doc.line(margin, 96, rightEdge, 96);
    y = 116;

    // ---- Receipt info row ----
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text("Receipt No", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(receiptNo, margin + 78, y);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text("Receipt Date", rightEdge - 200, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(receiptDate, rightEdge - 108, y);
    y += 12;

    // ---- Student Details ----
    headingText("Student Details");
    const studentPairs: Array<[string, string]> = [
      ["Student Name", name],
      ["Application No.", admission.applicationId || "-"],
      ["USN / Reg. No.", usn],
      ["Contact No.", contact],
      ["Branch & Year", `${branch} - ${year}`],
      ["Academic Year", academicYear],
      ["Admission Quota", quota],
    ];
    const studentPairsPerRow = 2;
    const colX2 = margin + Math.floor(contentWidth / 2) + 8;
    const renderPairs = (pairs: Array<[string, string]>) => {
      pairs.forEach(([label, value], i) => {
        const x = i % studentPairsPerRow === 0 ? margin : colX2;
        if (i % studentPairsPerRow === 0 && i > 0) y += 17;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(muted[0], muted[1], muted[2]);
        doc.text(label, x, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(ink[0], ink[1], ink[2]);
        doc.text(value === "" ? "-" : value, x + 96, y);
      });
    };
    renderPairs(studentPairs);
    y += 30;

    // ---- Payment Details ----
    headingText("Payment Details");
    const paymentPairs: Array<[string, string]> = [
      ["Payment Mode", admission.modeOfAdmission || "-"],
      ["Transaction No.", transactionId],
      ["Transaction Date", transactionDate],
      ["Remark", remark],
    ];
    renderPairs(paymentPairs);
    y += 30;

    // ---- Fee breakdown table ----
    headingText("Fee Breakdown");
    autoTable(doc, {
      startY: y,
      head: [["Particulars", "Amount (Rs)"]],
      body: [
        ["Admission & Tuition Fee", amountText],
        ["Miscellaneous Fees", "-"],
        ["Exam Fee", "-"],
        ["VTU / University Fees", "-"],
        ["Skill Lab Fee", "-"],
      ],
      foot: [["TOTAL", amountText]],
      theme: "grid",
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 9,
        cellPadding: 5,
        textColor: ink,
        lineColor: line,
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: brandDark,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      footStyles: {
        fillColor: tint,
        textColor: ink,
        fontStyle: "bold",
        fontSize: 10,
      },
      columnStyles: { 1: { halign: "right" } },
    });
    y =
      (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 16;

    // ---- Total + Amount in words ----
    doc.setFillColor(tint[0], tint[1], tint[2]);
    doc.setDrawColor(brand[0], brand[1], brand[2]);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, y - 12, contentWidth, 40, 4, 4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.text("Total Amount (Rs)", margin + 12, y + 2);
    doc.setFontSize(13);
    doc.text(`₹ ${amountText}`, rightEdge - 14, y + 2, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(`Amount in words : ${amountInWords}`, margin + 12, y + 15);
    y += 26;

    // ---- Footer ----
    y += 60;
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.line(rightEdge - 170, y - 6, rightEdge, y - 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text("Authorised Signature", rightEdge - 112, y + 8);

    doc.setFontSize(8);
    doc.text("This is a system generated receipt", W / 2, 828, {
      align: "center",
    });

    doc.save(`fee-receipt-${admission.applicationId || "application"}.pdf`);
  };

  const handlePay = async (id: string) => {
    setPayingId(id);
    try {
      await initiatePayment(id);
    } catch {
      // error handled by hook
    } finally {
      setPayingId(null);
    }
  };

  const handleShowDetails = (admission: FeePaymentResponse) => {
    setSelectedAdmission(admission);
    setIsDetailsOpen(true);
  };

  const columns = useMemo(() => {
    const baseColumns = [
      {
        id: "studentName",
        header: "Student",
        cell: ({ row }: { row: { original: FeePaymentResponse } }) => {
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
        cell: ({ row }: { row: { original: FeePaymentResponse } }) => (
          <Badge
            variant={
              row.original.status === "APPROVED"
                ? "default"
                : row.original.status === "SUBMITTED"
                  ? "secondary"
                  : row.original.status === "REJECTED"
                    ? "destructive"
                    : "outline"
            }
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "feeStatus",
        header: "Fee Status",
        cell: ({ row }: { row: { original: FeePaymentResponse } }) => {
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
        cell: ({ row }: { row: { original: FeePaymentResponse } }) => {
          const admission = row.original;
          const isPaid = admission.status === "APPROVED";
          const canPay = admission.status === "SUBMITTED";
          const isPaying = isProcessing && payingId === admission.id;

          return (
            <div className="flex flex-wrap items-center justify-end gap-2">
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
                ) : isPaid ? (
                  "Approved"
                ) : (
                  "Pay Now"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="whitespace-nowrap"
                onClick={() => handleShowDetails(admission)}
              >
                Details
              </Button>
            </div>
          );
        },
      },
    ];

    return baseColumns;
  }, [admissions, isProcessing, payingId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading fee payments...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-card text-card-foreground space-y-6 rounded-lg border p-6 shadow-sm">
        <div className="space-y-4">
          <FilterBuilder
            fields={filterFields}
            draftFilters={draftFilters}
            onDraftChange={updateDraftFilter}
            allValue={ALL_FILTERS_VALUE}
            className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-6"
          />

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <FilterActions onApply={applyFilters} onReset={resetFilters} />

            <Button variant="outline" onClick={generateReportPdf}>
              <FileDown className="mr-2 h-4 w-4" />
              Generate Fee Report PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="bg-muted/30 rounded-md border p-3">
            <p className="text-muted-foreground text-sm">Total</p>
            <p className="text-xl font-semibold">{summary.total}</p>
          </div>
          <div className="bg-muted/30 rounded-md border p-3">
            <p className="text-muted-foreground text-sm">Paid</p>
            <p className="text-xl font-semibold">{summary.paid}</p>
          </div>
          <div className="bg-muted/30 rounded-md border p-3">
            <p className="text-muted-foreground text-sm">Unpaid</p>
            <p className="text-xl font-semibold">{summary.unpaid}</p>
          </div>
          <div className="bg-muted/30 rounded-md border p-3">
            <p className="text-muted-foreground text-sm">Approved</p>
            <p className="text-xl font-semibold">{summary.approved}</p>
          </div>
          <div className="bg-muted/30 rounded-md border p-3">
            <p className="text-muted-foreground text-sm">Pending Review</p>
            <p className="text-xl font-semibold">{summary.pending}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">
              Fee Payments
            </h3>
            <p className="text-muted-foreground text-sm">
              Record payments, review approvals, and generate receipts for
              filtered admissions.
            </p>
          </div>
          {isFetching && (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          )}
        </div>

        <DataTable columns={columns} data={admissions} />

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Student Fee Details</DialogTitle>
              <DialogDescription>
                Review the selected student&apos;s fee information and download
                the receipt.
              </DialogDescription>
            </DialogHeader>

            {selectedAdmission ? (
              <div className="space-y-4">
                <div className="bg-muted/20 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {getFullName(selectedAdmission)}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {selectedAdmission.primaryEmail || "-"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        selectedAdmission.status === "APPROVED"
                          ? "default"
                          : selectedAdmission.status === "SUBMITTED"
                            ? "secondary"
                            : selectedAdmission.status === "REJECTED"
                              ? "destructive"
                              : "outline"
                      }
                    >
                      {selectedAdmission.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Application ID
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedAdmission.applicationId || "-"}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Admission Mode
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedAdmission.modeOfAdmission || "-"}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Fee Paid
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedAdmission.feePaid != null
                        ? `₹${selectedAdmission.feePaid}`
                        : "Not paid"}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Receipt No.
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedAdmission.feeReceiptNumber || "-"}
                    </p>
                  </div>
                  <div className="rounded-md border p-3 md:col-span-2">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Department
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedAdmission.department?.name || "-"}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => generateReceiptPdf(selectedAdmission)}
                    disabled={selectedAdmission.status !== "APPROVED"}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Download Receipt
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
