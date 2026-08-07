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
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
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
import { feePaymentColumns, FeePaymentResponse } from "./fee-payment-columns";

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

  const summary = useMemo(() => {
    const paid = admissions.filter(
      (admission) => admission.feePaid != null && admission.feePaid > 0
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
  }, [admissions]);

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
      `Total records: ${admissions.length} | Paid: ${summary.paid} | Unpaid: ${summary.unpaid}`,
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

        <DataTable columns={feePaymentColumns} data={admissions} />
      </div>
    </div>
  );
};
