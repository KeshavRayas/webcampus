"use client";

import { apiClient } from "@/lib/api-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useCascadingFilterSync } from "@/lib/use-cascading-filter-sync";
import { useAdmissionDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { admissionModes, admissionTypes } from "@webcampus/schemas/constants";
import { BaseResponse } from "@webcampus/types/api";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  FilterActions,
  FilterBuilder,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { AdmissionResponse } from "../admin/admin-admission-columns";
import { useAdmissionPayment } from "./use-admission-payment";

const PAYMENT_STATUS_VALUES = ["PAID", "UNPAID"] as const;

type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];

type FeePaymentFilters = {
  academicTerm: string;
  semester: string;
  applicationId: string;
  mode: string;
  admissionType: string;
  createdFrom: string;
  createdTo: string;
  paymentStatus: PaymentStatus | "";
};

const EMPTY_FILTERS: FeePaymentFilters = {
  academicTerm: "",
  semester: "",
  applicationId: "",
  mode: "",
  admissionType: "",
  createdFrom: "",
  createdTo: "",
  paymentStatus: "",
};

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
  const [payingId, setPayingId] = useState<string | null>(null);
  const { initiatePayment, isProcessing } = useAdmissionPayment();

  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];
  const { data: departments } = useAdmissionDepartments();
  const selectedTerm = terms.find(
    (term) => term.id === draftFilters.academicTerm
  );
  const nestedSemesters = selectedTerm?.Semester || [];

  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: nestedSemesters,
    departments,
  });

  const updateDraftFilter = <K extends keyof FeePaymentFilters>(
    key: K,
    value: FeePaymentFilters[K]
  ) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
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
    {
      key: "paymentStatus",
      label: "Payment Status",
      type: "select",
      placeholder: "All payment statuses",
      allOptionLabel: "All payment statuses",
      options: PAYMENT_STATUS_VALUES.map((status) => ({
        label: status === "PAID" ? "Paid" : "Unpaid",
        value: status,
      })),
    },
  ];

  const queryFilters = {
    academicTerm: appliedFilters.academicTerm,
    semester: appliedFilters.semester,
    applicationId: appliedFilters.applicationId,
    mode: appliedFilters.mode,
    admissionType: appliedFilters.admissionType,
    createdFrom: appliedFilters.createdFrom,
    createdTo: appliedFilters.createdTo,
  };
  const query = createFilterQueryString(queryFilters);
  const { data, isFetching, isLoading } = useQuery({
    queryKey: ["admissions", "fee-payment", appliedFilters],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<AdmissionResponse[]>>(
        `/admission${query ? `?${query}` : ""}`,
        { withCredentials: true }
      );
      if (res.data.status === "success" && Array.isArray(res.data.data)) {
        return res.data.data;
      }
      return [] as AdmissionResponse[];
    },
  });

  const filteredAdmissions = useMemo(() => {
    let admissions = data ?? [];

    if (appliedFilters.paymentStatus === "PAID") {
      admissions = admissions.filter(
        (admission) => admission.status === "APPROVED"
      );
    } else if (appliedFilters.paymentStatus === "UNPAID") {
      admissions = admissions.filter(
        (admission) => admission.status !== "APPROVED"
      );
    }

    return admissions;
  }, [appliedFilters.paymentStatus, data]);

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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading admissions...
      </div>
    );
  }

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
        {isFetching && (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        )}
      </div>

      <FilterBuilder
        fields={filterFields}
        draftFilters={draftFilters}
        onDraftChange={updateDraftFilter}
        className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-6"
      />
      <div className="flex justify-end">
        <FilterActions onApply={applyFilters} onReset={resetFilters} />
      </div>

      <DataTable columns={columns} data={filteredAdmissions} />
    </div>
  );
};
