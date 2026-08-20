"use client";

import { apiClient } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useAdmissionConstants } from "@/lib/use-admission-constants";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAdmissionDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import { admissionTypes } from "@webcampus/schemas/constants";
import { BaseResponse } from "@webcampus/types/api";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@webcampus/ui/components/avatar";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import { type FilterFieldConfig } from "@webcampus/ui/components/filter-builder";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import { FileDown, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { getAdmissionFullName } from "../admin/admin-admission-columns";
import { renderNodeToPdf } from "../applicant/admission-pdf";
import { ApplicantAdmissionView } from "../applicant/applicant-admission-view";
import { AdmissionFilterBar } from "../shared/admission-filter-bar";
import { FeeReceiptDocument, type FeeReceiptData } from "./fee-document";
import { type FeePaymentResponse } from "./fee-payment-columns";
import { useAdmissionPayment } from "./use-admission-payment";

const ADMISSION_STATUSES = [
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;

type FeePaymentFilters = {
  academicTerm: string;
  semester: string;
  search: string;
  status: string;
  feeStatus: string;
  mode: string;
  admissionType: string;
  filledBy: string;
  createdFrom: string;
  createdTo: string;
};

const EMPTY_FILTERS: FeePaymentFilters = {
  academicTerm: "",
  semester: "",
  search: "",
  status: "",
  feeStatus: "",
  mode: "",
  admissionType: "",
  filledBy: "",
  createdFrom: "",
  createdTo: "",
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
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [paymentAdmission, setPaymentAdmission] =
    useState<FeePaymentResponse | null>(null);
  const [feeReceiptNumber, setFeeReceiptNumber] = useState("");
  const [feeAmount, setFeeAmount] = useState(0);
  const [isFetchingFee, setIsFetchingFee] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const { initiatePayment, isProcessing } = useAdmissionPayment();
  const [receiptData, setReceiptData] = useState<FeeReceiptData | null>(null);
  const receiptRef = useRef<HTMLDivElement | null>(null);

  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];
  const { data: departments = [] } = useAdmissionDepartments();

  const { data: admissionConstants } = useAdmissionConstants();
  const admissionModes = admissionConstants?.modes ?? [];
  const selectedTerm = terms.find((t) => t.id === draftFilters.academicTerm);
  const nestedSemesters = selectedTerm?.Semester || [];

  const semesterOptions = nestedSemesters.filter(
    (semester) =>
      (semester.programType === "UG" &&
        (semester.semesterNumber === 1 || semester.semesterNumber === 3)) ||
      (semester.programType === "PG" && semester.semesterNumber === 1)
  );

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: semesterOptions,
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

  const query = createFilterQueryString(
    (() => {
      const apiFilters: Omit<FeePaymentFilters, "search"> = {
        ...appliedFilters,
      };
      return apiFilters;
    })()
  );
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

  const admissions = useMemo(() => {
    let rows = data ?? [];
    const search = appliedFilters.search.trim().toLowerCase();
    if (search) {
      rows = rows.filter(
        (admission) =>
          getAdmissionFullName(admission).toLowerCase().includes(search) ||
          admission.primaryEmail?.toLowerCase().includes(search)
      );
    }
    if (appliedFilters.filledBy) {
      rows = rows.filter(
        (admission) => admission.filledBy?.id === appliedFilters.filledBy
      );
    }
    return rows;
  }, [data, appliedFilters.search, appliedFilters.filledBy]);

  const filledByOptions = useMemo(() => {
    const byId = new Map<string, { label: string; value: string }>();
    (data ?? []).forEach((admission) => {
      if (admission.filledBy?.id) {
        byId.set(admission.filledBy.id, {
          value: admission.filledBy.id,
          label:
            admission.filledBy.name || admission.filledBy.email || "Unknown",
        });
      }
    });
    return Array.from(byId.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [data]);

  const simpleFilterFields: FilterFieldConfig<FeePaymentFilters>[] = [
    {
      key: "academicTerm",
      label: "Academic Term",
      type: "select",
      placeholder: "All terms",
      allOptionLabel: "All terms",
      options: terms.map((term) => ({
        label: `${term.type.toUpperCase()} ${term.year}`,
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
      options: semesterOptions.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: semester.id,
      })),
    },
  ];

  const advancedFilterFields: FilterFieldConfig<FeePaymentFilters>[] = [
    {
      key: "search",
      label: "Search",
      type: "text",
      placeholder: "Search by name or email",
      inputId: "fee-payment-search",
    },
    {
      key: "filledBy",
      label: "Filled By",
      type: "select",
      placeholder: "All",
      allOptionLabel: "All",
      options: filledByOptions,
    },
    {
      key: "createdFrom",
      label: "Created From",
      type: "date",
      inputId: "fee-payment-created-from",
    },
    {
      key: "createdTo",
      label: "Created To",
      type: "date",
      inputId: "fee-payment-created-to",
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
      key: "feeStatus",
      label: "Fee Status",
      type: "select",
      placeholder: "All fee statuses",
      allOptionLabel: "All fee statuses",
      options: [
        { label: "Paid", value: "true" },
        { label: "Unpaid", value: "false" },
      ],
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
  ];

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

  const generateReceiptPdf = (admission: FeePaymentResponse) => {
    if (!admission) {
      toast.error("No student details available for receipt.");
      return;
    }

    const contact = admission.primaryPhoneNumber || "-";
    const branch = admission.department?.name || "-";
    const quota = admission.quota || admission.categoryAllotted || "-";
    const totalAmount = admission.feePaid;
    const hasAmount =
      typeof totalAmount === "number" && Number.isFinite(totalAmount);
    const amountText = hasAmount ? totalAmount.toLocaleString("en-IN") : "-";
    const amountInWords = hasAmount
      ? RUPEES_TEXT(totalAmount)
      : "Rupees Zero Only";

    setReceiptData({
      receiptNo: admission.feeReceiptNumber || "-",
      receiptDate: new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      name: getFullName(admission),
      usn: admission.student?.usn || "-",
      contact,
      branch,
      quota,
      paymentMode: admission.modeOfAdmission || "-",
      transactionId: "-",
      transactionDate: "-",
      totalAmountText: amountText,
      amountInWords,
    });
  };

  useEffect(() => {
    if (!receiptData) return;
    const node = receiptRef.current;
    if (!node) return;
    void renderNodeToPdf(
      node,
      `fee-receipt-${new Date().toISOString().slice(0, 10)}.pdf`
    )
      .then(() => toast.success("Fee receipt PDF downloaded."))
      .catch(() => toast.error("Failed to generate the fee receipt PDF."))
      .finally(() => setReceiptData(null));
  }, [receiptData]);

  const handlePay = (admission: FeePaymentResponse) => {
    setPaymentAdmission(admission);
    setFeeReceiptNumber("");
    setFeeAmount(0);
    setIsPayOpen(true);

    const params = new URLSearchParams();
    if (admission.departmentId) {
      params.set("departmentId", admission.departmentId);
    }
    if (admission.modeOfAdmission) {
      params.set("modeOfAdmission", admission.modeOfAdmission);
    }
    if (admission.categoryAllotted) {
      params.set("categoryAllotted", admission.categoryAllotted);
    }
    if (admission.quota) {
      params.set("quota", admission.quota);
    }

    if (params.size === 0) {
      return;
    }

    setIsFetchingFee(true);
    apiClient
      .get<BaseResponse<{ feeAmount: number }>>(
        `/admission/fee-structure?${params.toString()}`,
        { withCredentials: true }
      )
      .then((response) => {
        if (response.data.status === "success" && response.data.data != null) {
          setFeeAmount(response.data.data.feeAmount);
        }
      })
      .finally(() => setIsFetchingFee(false));
  };

  const handleConfirmPay = async () => {
    if (!paymentAdmission) return;
    setPayingId(paymentAdmission.id);
    try {
      await initiatePayment({
        id: paymentAdmission.id,
        feePaid: feeAmount,
        feeReceiptNumber: feeReceiptNumber.trim() || undefined,
      });
      setIsPayOpen(false);
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
        id: "name",
        header: "Name",
        cell: ({ row }: { row: { original: FeePaymentResponse } }) => (
          <div className="font-medium">
            {getAdmissionFullName(row.original)}
          </div>
        ),
      },
      {
        id: "email",
        header: "Email",
        cell: ({ row }: { row: { original: FeePaymentResponse } }) => (
          <div>{row.original.primaryEmail}</div>
        ),
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
        cell: ({ row }: { row: { original: FeePaymentResponse } }) => {
          const admission = row.original;
          const isPaid = admission.feeStatus === true;
          const canPay = true;
          const isPaying = isProcessing && payingId === admission.id;

          return (
            <div className="flex flex-wrap items-center gap-2">
              {!isPaid && (
                <Button
                  size="sm"
                  onClick={() => handlePay(admission)}
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
              )}
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
          <AdmissionFilterBar
            simpleFields={simpleFilterFields}
            advancedFields={advancedFilterFields}
            draftFilters={draftFilters}
            onDraftChange={updateDraftFilter}
            onApply={applyFilters}
            onReset={resetFilters}
            dialogTitle="Advanced Filters"
            dialogDescription="Filter fee payments by email, status, mode, and date range."
          />
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
          <DialogContent className="admission-theme-dialog max-w-2xl">
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-16 rounded-lg">
                        <AvatarImage
                          src={selectedAdmission.photo ?? undefined}
                          alt={getFullName(selectedAdmission)}
                        />
                        <AvatarFallback className="rounded-lg text-lg font-semibold">
                          {getFullName(selectedAdmission)
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">
                          {getFullName(selectedAdmission)}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {selectedAdmission.primaryEmail || "-"}
                        </p>
                      </div>
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
                      Admission Mode
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedAdmission.modeOfAdmission || "-"}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Admission Type
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedAdmission.admissionType || "-"}
                    </p>
                  </div>

                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Quota
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedAdmission.quota || "-"}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Category Allotted
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedAdmission.categoryAllotted || "-"}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Category Claimed
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedAdmission.categoryClaimed || "-"}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      USN
                    </p>
                    <p className="mt-1 font-medium">
                      {selectedAdmission.student?.usn || "-"}
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

        <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
          <DialogContent className="admission-theme-dialog sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record Fee Payment</DialogTitle>
              <DialogDescription>
                Confirm the fee amount and receipt details to approve the
                admission.
              </DialogDescription>
            </DialogHeader>

            {paymentAdmission ? (
              <div className="space-y-4">
                <div className="bg-muted/20 rounded-lg border p-4">
                  <p className="text-sm font-semibold">
                    {getFullName(paymentAdmission)}
                  </p>
                  <p className="text-muted-foreground break-all text-sm">
                    {paymentAdmission.primaryEmail}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {paymentAdmission.department?.name || "-"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feeAmount">Fee Amount (₹)</Label>
                  {isFetchingFee ? (
                    <div className="bg-muted/20 flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading fee structure...
                    </div>
                  ) : (
                    <Input
                      id="feeAmount"
                      type="number"
                      min={0}
                      step="any"
                      value={feeAmount}
                      onChange={(event) =>
                        setFeeAmount(Number(event.target.value))
                      }
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feeReceiptNumber">Fee Receipt Number *</Label>
                  <Input
                    id="feeReceiptNumber"
                    value={feeReceiptNumber}
                    onChange={(event) =>
                      setFeeReceiptNumber(event.target.value)
                    }
                    placeholder="Enter receipt number"
                    maxLength={100}
                  />
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPayOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void handleConfirmPay()}
                    disabled={isProcessing || !feeReceiptNumber.trim()}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Confirm Payment"
                    )}
                  </Button>
                </DialogFooter>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>

      <div
        className="pointer-events-none absolute left-[-10000px] top-0"
        aria-hidden="true"
      >
        <div ref={receiptRef}>
          {receiptData ? <FeeReceiptDocument data={receiptData} /> : null}
        </div>
      </div>
    </div>
  );
};
