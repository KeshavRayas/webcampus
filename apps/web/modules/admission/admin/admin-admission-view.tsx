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
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@webcampus/ui/components/dialog";
import {
  FilterActions,
  FilterBuilder,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import { Eye, EyeOff, FileDown, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { renderNodeToPdf } from "../applicant/admission-pdf";
import { AdmissionFilterBar } from "../shared/admission-filter-bar";
import {
  AdmissionResponse,
  getAdminAdmissionColumns,
} from "./admin-admission-columns";
import {
  AdmissionsReportDocument,
  type AdmissionsReportData,
} from "./admissions-report-document";
import { useCreateAdmissionShellForm } from "./use-create-admission-shell-form";
import { usePortStudents } from "./use-port-students";

// const ADMISSION_MODES = [
//   "KCET",
//   "COMEDK",
//   "Management",
//   "SNQ Quota",
//   "Other",
// ] as const;
// const ADMISSION_CATEGORIES = ["GENERAL", "OBC", "SC", "ST"] as const;
const ALL_FILTERS_VALUE = "__all__";

type AdmissionFilters = {
  applicationId: string;
  academicTerm: string;
  semester: string;
  email: string;
  createdFrom: string;
  createdTo: string;
};

const EMPTY_FILTERS: AdmissionFilters = {
  applicationId: "",
  academicTerm: "",
  semester: "",
  email: "",
  createdFrom: "",
  createdTo: "",
};

export const AdminAdmissionView = ({
  hideAddForm = false,
  showFilters = false,
  admissionSemestersOnly = false,
}: {
  hideAddForm?: boolean;
  showFilters?: boolean;
  /** Only show UG/PG Semesters 1 and 3 in the semester filter */
  admissionSemestersOnly?: boolean;
}) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const { data: session } = authClient.useSession();
  const role = session?.user?.role;
  const canCreate =
    isMounted &&
    (role === "admin" ||
      role === "admission" ||
      role === "admission-instructor");
  const canPort = isMounted && (role === "admin" || role === "admission");

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialFilters = getFiltersFromSearchParams(
    searchParams,
    EMPTY_FILTERS
  );

  const [draftFilters, setDraftFilters] =
    useState<AdmissionFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<AdmissionFilters>(initialFilters);
  const [isPortPreviewOpen, setIsPortPreviewOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createChoice, setCreateChoice] = useState<null | "profile" | "fill">(
    null
  );
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [reportData, setReportData] = useState<AdmissionsReportData | null>(
    null
  );
  const reportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showFilters) return;
    const nextFilters = getFiltersFromSearchParams(searchParams, EMPTY_FILTERS);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams, showFilters]);

  // Use standardized hooks for fresh data
  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];
  const { data: departments = [] } = useAdmissionDepartments();

  // Sync filters when data changes (auto-clear if value no longer exists)
  const selectedTerm = terms.find((t) => t.id === draftFilters.academicTerm);
  const nestedSemesters = selectedTerm?.Semester || [];
  const admissionEligibleSemesters = nestedSemesters.filter(
    (semester) =>
      (semester.programType === "UG" || semester.programType === "PG") &&
      (semester.semesterNumber === 1 || semester.semesterNumber === 3)
  );
  const semesterOptions = admissionSemestersOnly
    ? admissionEligibleSemesters
    : nestedSemesters;
  useCascadingFilterSync(draftFilters, setDraftFilters, {
    academicTerms: terms,
    semesters: semesterOptions,
    departments,
  });

  // 2. Fetch Admissions for the selected filters
  const {
    data: admissions,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["admissions", appliedFilters],
    queryFn: async () => {
      const apiFilters: Omit<AdmissionFilters, "email"> = {
        ...appliedFilters,
      };
      const query = createFilterQueryString(apiFilters);
      const res = await apiClient.get<BaseResponse<AdmissionResponse[]>>(
        `/admission${query ? `?${query}` : ""}`,
        { withCredentials: true }
      );
      if (res.data.status === "success") return res.data.data;
      return [];
    },
  });
  const relevantAdmissions = useMemo(() => {
    const email = appliedFilters.email.trim().toLowerCase();
    if (!email) return admissions ?? [];
    return (admissions ?? []).filter((admission) =>
      admission.primaryEmail.toLowerCase().includes(email)
    );
  }, [admissions, appliedFilters.email]);
  const selectedSemesterId = draftFilters.semester;
  const { form, onSubmit } = useCreateAdmissionShellForm(
    selectedSemesterId,
    departments
  );
  const { onPortStudents, isPorting } = usePortStudents();

  const selectedSemester = nestedSemesters.find(
    (semester) => semester.id === selectedSemesterId
  );
  const { data: semesterAdmissions, isFetching: isFetchingSemesterAdmissions } =
    useQuery({
      queryKey: ["admissions", "semester", selectedSemesterId],
      queryFn: async () => {
        if (!selectedSemesterId) return [] as AdmissionResponse[];

        const res = await apiClient.get<BaseResponse<AdmissionResponse[]>>(
          `/admission/semester/${selectedSemesterId}`,
          { withCredentials: true }
        );

        if (res.data.status === "success" && Array.isArray(res.data.data)) {
          return res.data.data;
        }

        return [] as AdmissionResponse[];
      },
      enabled: showFilters && !!selectedSemesterId,
    });

  const unresolvedAdmissionsCount = (semesterAdmissions || []).filter(
    (admission) =>
      admission.status === "PENDING" || admission.status === "SUBMITTED"
  ).length;

  const approvedAdmissions = (semesterAdmissions || []).filter(
    (admission) => admission.status === "APPROVED"
  );

  const admissionsToPort = approvedAdmissions.filter(
    (admission) => !admission.student?.usn
  );

  const alreadyPortedAdmissions = approvedAdmissions.filter(
    (admission) => !!admission.student?.usn
  );

  const handleConfirmPort = () => {
    if (!selectedSemesterId) {
      toast.error("Please select a semester first");
      return;
    }

    onPortStudents(
      { semesterId: selectedSemesterId },
      {
        onSuccess: () => {
          setIsPortPreviewOpen(false);
        },
      }
    );
  };

  const getFullName = (admission: AdmissionResponse) => {
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

  const generateReportPdf = () => {
    const rows = admissions ?? [];
    if (rows.length === 0) {
      toast.error("No admissions to include in the report.");
      return;
    }

    const statusCount = (status: AdmissionResponse["status"]) =>
      rows.filter((admission) => admission.status === status).length;

    setReportData({
      generatedAt: new Date().toLocaleString(),
      total: rows.length,
      approved: statusCount("APPROVED"),
      submitted: statusCount("SUBMITTED"),
      pending: statusCount("PENDING") + statusCount("SUBMITTED"),
      rejected: statusCount("REJECTED"),
      rows: rows.map((admission) => ({
        applicationId: admission.applicationId || "-",
        name: getFullName(admission),
        email: admission.primaryEmail || "-",
        status: admission.status || "-",
        branch: admission.department?.name || "-",
        mode: admission.modeOfAdmission || "-",
        quota: admission.quota || "-",
        feePaid: admission.feePaid != null ? String(admission.feePaid) : "-",
        receiptNo: admission.feeReceiptNumber || "-",
      })),
    });
  };

  useEffect(() => {
    if (!reportData) return;
    const node = reportRef.current;
    if (!node) return;
    void renderNodeToPdf(
      node,
      `admissions-report-${new Date().toISOString().slice(0, 10)}.pdf`
    )
      .then(() => toast.success("Admissions report PDF downloaded."))
      .catch(() => toast.error("Failed to generate the admissions report PDF."))
      .finally(() => setReportData(null));
  }, [reportData]);

  const updateDraftFilter = (key: keyof AdmissionFilters, value: string) => {
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

  const simpleFilterFields: FilterFieldConfig<AdmissionFilters>[] = [
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
      options: semesterOptions.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: semester.id,
      })),
    },
  ];

  const advancedFilterFields: FilterFieldConfig<AdmissionFilters>[] = [
    {
      key: "email",
      label: "Email",
      type: "text",
      placeholder: "Search by email",
      inputId: "admission-email",
    },
    {
      key: "applicationId",
      label: "Application ID",
      type: "text",
      placeholder: "Search application ID",
      inputId: "admission-application-id",
    },
    {
      key: "createdFrom",
      label: "Created From",
      type: "date",
      inputId: "admission-created-from",
      className: "xl:col-start-1",
    },
    {
      key: "createdTo",
      label: "Created To",
      type: "date",
      inputId: "admission-created-to",
      className: "xl:col-start-2",
    },
  ];

  const additionalFilterFields: FilterFieldConfig<AdmissionFilters>[] = [
    {
      key: "applicationId",
      label: "Application ID",
      type: "text",
      placeholder: "Search application ID",
      inputId: "admission-application-id",
    },
    {
      key: "createdFrom",
      label: "Created From",
      type: "date",
      inputId: "admission-created-from",
      className: "xl:col-start-1",
    },
    {
      key: "createdTo",
      label: "Created To",
      type: "date",
      inputId: "admission-created-to",
      className: "xl:col-start-2",
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
    setIsFilterDialogOpen(false);
    if (showFilters) {
      const query = createFilterQueryString(draftFilters);
      router.replace(`${pathname}${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    }
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setIsFilterDialogOpen(false);
    if (showFilters) {
      router.replace(pathname, { scroll: false });
    }
  };

  const fillApplicantPath =
    role === "admission-instructor"
      ? "/admission-instructor/fill-applicant"
      : "/admission/fill-applicant";

  const handleCreateDialogOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      setCreateChoice(null);
    }
  };

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
          />

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <FilterActions onApply={applyFilters} onReset={resetFilters} />

              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFilterDialogOpen(true)}
              >
                Filter
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={generateReportPdf}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Generate Admissions Report PDF
              </Button>
            </div>

            <Dialog
              open={isFilterDialogOpen}
              onOpenChange={setIsFilterDialogOpen}
            >
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Advanced Filters</DialogTitle>
                  <DialogDescription>
                    Filter admissions by application ID and created date range.
                  </DialogDescription>
                </DialogHeader>
                <FilterBuilder
                  fields={additionalFilterFields}
                  draftFilters={draftFilters}
                  onDraftChange={updateDraftFilter}
                  allValue={ALL_FILTERS_VALUE}
                  className="grid-cols-1 sm:grid-cols-2"
                />
                <DialogFooter>
                  <Button variant="outline" onClick={resetFilters}>
                    Reset Filters
                  </Button>
                  <Button type="button" onClick={applyFilters}>
                    Apply Filters
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {!hideAddForm && canCreate && (
              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={handleCreateDialogOpenChange}
              >
                <DialogTrigger asChild>
                  <Button disabled={!draftFilters.semester}>
                    Create Admission
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  {createChoice === null ? (
                    <>
                      <DialogHeader>
                        <DialogTitle>Create Admission</DialogTitle>
                        <DialogDescription>
                          Choose how you want to create the admission for the
                          selected semester.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-3">
                        <button
                          type="button"
                          className="bg-card hover:bg-accent rounded-lg border p-4 text-left transition"
                          onClick={() => setCreateChoice("profile")}
                        >
                          <p className="font-medium">
                            Create Admission Profile / Shell
                          </p>
                          <p className="text-muted-foreground mt-1 text-sm">
                            Create a shell so the applicant can log in and fill
                            the form themselves.
                          </p>
                        </button>
                        <button
                          type="button"
                          className="bg-card hover:bg-accent rounded-lg border p-4 text-left transition"
                          onClick={() => {
                            setCreateChoice(null);
                            setIsCreateDialogOpen(false);
                            router.push(
                              `${fillApplicantPath}?semester=${draftFilters.semester}`
                            );
                          }}
                        >
                          <p className="font-medium">Fill Application Now</p>
                          <p className="text-muted-foreground mt-1 text-sm">
                            Fill and submit the application form directly for
                            the selected semester.
                          </p>
                        </button>
                      </div>
                    </>
                  ) : (
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit((values) => {
                          onSubmit(values);
                          setIsCreateDialogOpen(false);
                          setCreateChoice(null);
                        })}
                        className="space-y-4"
                      >
                        <DialogHeader>
                          <DialogTitle>Create Admission Profile</DialogTitle>
                          <DialogDescription>
                            The applicant will use these credentials to log in
                            and complete the admission form.
                          </DialogDescription>
                        </DialogHeader>
                        <FormField
                          control={form.control}
                          name="primaryEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Primary Email *</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="student@bmsce.ac.in"
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password *</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter initial password"
                                    {...field}
                                    value={field.value ?? ""}
                                    className="pr-10"
                                  />

                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                    onClick={() => setShowPassword((v) => !v)}
                                  >
                                    {showPassword ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setCreateChoice(null)}
                          >
                            Back
                          </Button>
                          <Button
                            type="submit"
                            disabled={form.formState.isSubmitting}
                          >
                            Create Profile
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  )}
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {!hideAddForm && canCreate && !draftFilters.semester && (
          <p className="text-muted-foreground text-sm">
            Select an admission semester above before creating a new admission
            shell.
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Admissions</h3>
            <p className="text-muted-foreground text-sm">
              {showFilters
                ? "Filter by academic term, semester, application ID, and created date."
                : "Showing admissions for the selected semester."}
            </p>
            {showFilters && selectedSemesterId && (
              <p
                className="text-muted-foreground mt-1 text-sm"
                suppressHydrationWarning
              >
                {isFetchingSemesterAdmissions
                  ? "Checking port readiness..."
                  : unresolvedAdmissionsCount > 0
                    ? `${unresolvedAdmissionsCount} application(s) still pending review before porting.`
                    : "All applications are reviewed. Ready to port approved students."}
              </p>
            )}
          </div>

          {showFilters && canPort && (
            <Button
              onClick={() => {
                if (!selectedSemesterId) {
                  toast.error("Please select a semester first");
                  return;
                }
                setIsPortPreviewOpen(true);
              }}
              disabled={
                !selectedSemesterId || isFetchingSemesterAdmissions || isPorting
              }
            >
              {isPorting ? "Porting..." : "Preview Port"}
            </Button>
          )}
        </div>

        {showFilters && (
          <Dialog open={isPortPreviewOpen} onOpenChange={setIsPortPreviewOpen}>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Preview Student Port</DialogTitle>
                <DialogDescription>
                  Review admissions for{" "}
                  {selectedSemester
                    ? `${selectedSemester.programType} - Semester ${selectedSemester.semesterNumber}`
                    : "the selected semester"}{" "}
                  before final port.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                  <div className="bg-muted/30 rounded-md border p-3">
                    <p className="text-muted-foreground">Pending/Submitted</p>
                    <p className="text-lg font-semibold">
                      {unresolvedAdmissionsCount}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-md border p-3">
                    <p className="text-muted-foreground">Will be ported</p>
                    <p className="text-lg font-semibold">
                      {admissionsToPort.length}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-md border p-3">
                    <p className="text-muted-foreground">Already ported</p>
                    <p className="text-lg font-semibold">
                      {alreadyPortedAdmissions.length}
                    </p>
                  </div>
                </div>

                {admissionsToPort.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Admissions that will be ported
                    </p>
                    <div className="max-h-56 overflow-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0 z-10">
                          <tr>
                            <th className="bg-muted px-3 py-2 text-left font-medium">
                              Application ID
                            </th>
                            <th className="bg-muted px-3 py-2 text-left font-medium">
                              Student Name
                            </th>
                            <th className="bg-muted px-3 py-2 text-left font-medium">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {admissionsToPort.map((admission) => {
                            const fullName = admission.nameAsPer10th?.trim();
                            return (
                              <tr key={admission.id} className="border-t">
                                <td className="px-3 py-2">
                                  {admission.applicationId}
                                </td>
                                <td className="px-3 py-2">{fullName || "-"}</td>
                                <td className="px-3 py-2">
                                  {admission.status}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No approved admissions pending port in this semester.
                  </p>
                )}

                {unresolvedAdmissionsCount > 0 && (
                  <p className="text-sm font-medium text-amber-700">
                    Port is disabled until all admissions are reviewed (no
                    pending or submitted records).
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPortPreviewOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmPort}
                  disabled={
                    isPorting ||
                    unresolvedAdmissionsCount > 0 ||
                    admissionsToPort.length === 0
                  }
                >
                  {isPorting
                    ? "Porting..."
                    : `Confirm Port (${admissionsToPort.length})`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading admissions...
          </div>
        ) : (
          <div className="space-y-3">
            {isFetching && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying filters...
              </div>
            )}
            <DataTable
              columns={getAdminAdmissionColumns(
                showFilters,
                role !== "admission-instructor"
              )}
              data={relevantAdmissions}
            />
          </div>
        )}
      </div>

      <div
        className="pointer-events-none absolute left-[-10000px] top-0"
        aria-hidden="true"
      >
        <div ref={reportRef}>
          {reportData ? <AdmissionsReportDocument data={reportData} /> : null}
        </div>
      </div>
    </div>
  );
};
