"use client";

import { apiClient } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useQuery } from "@tanstack/react-query";
import { AcademicTermResponseType } from "@webcampus/schemas/admin";
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
} from "@webcampus/ui/components/dialog";
import {
  FilterActions,
  FilterBuilder,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { DialogForm } from "@webcampus/ui/molecules/dialog-form";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  AdmissionResponse,
  getAdminAdmissionColumns,
} from "./admin-admission-columns";
import { useCreateAdmissionShellForm } from "./use-create-admission-shell-form";
import { usePortStudents } from "./use-port-students";

const ADMISSION_MODES = ["KCET", "COMEDK", "Management", "SNQ Quota", "Other"];
const ADMISSION_STATUSES = ["PENDING", "SUBMITTED", "APPROVED", "REJECTED"];
const ALL_FILTERS_VALUE = "__all__";

type AdmissionFilters = {
  applicationId: string;
  status: string;
  mode: string;
  academicTerm: string;
  semester: string;
  createdFrom: string;
  createdTo: string;
};

const EMPTY_FILTERS: AdmissionFilters = {
  applicationId: "",
  status: "",
  mode: "",
  academicTerm: "",
  semester: "",
  createdFrom: "",
  createdTo: "",
};

export const AdminAdmissionView = ({
  hideAddForm = false,
  showFilters = false,
}: {
  hideAddForm?: boolean;
  showFilters?: boolean;
}) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const { data: session } = authClient.useSession();
  const role = session?.user?.role;
  const canCreate =
    isMounted && (role === "admin" || role === "admission_admin");
  const canPort =
    isMounted && (role === "admin" || role === "admission_reviewer");

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftFilters, setDraftFilters] = useState<AdmissionFilters>(() =>
    showFilters
      ? getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
      : EMPTY_FILTERS
  );
  const [appliedFilters, setAppliedFilters] = useState<AdmissionFilters>(() =>
    showFilters
      ? getFiltersFromSearchParams(searchParams, EMPTY_FILTERS)
      : EMPTY_FILTERS
  );
  const [isPortPreviewOpen, setIsPortPreviewOpen] = useState(false);

  useEffect(() => {
    if (!showFilters) return;
    const nextFilters = getFiltersFromSearchParams(searchParams, EMPTY_FILTERS);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams, showFilters]);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await apiClient.get<
        BaseResponse<{ id: string; name: string }[]>
      >(`/admission/departments`, { withCredentials: true });
      if (res.data.status === "success" && Array.isArray(res.data.data)) {
        return res.data.data;
      }
      return [];
    },
  });

  // 1. Fetch Academic Terms
  const { data: terms } = useQuery({
    queryKey: ["academic-terms"],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<AcademicTermResponseType[]>>(
        `/admin/semester`,
        { withCredentials: true }
      );
      if (res.data.status === "success") return res.data.data;
      return [];
    },
  });
  const termOptions = Array.isArray(terms) ? terms : [];

  // 2. Fetch Admissions for the selected filters
  const {
    data: admissions,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["admissions", appliedFilters],
    queryFn: async () => {
      const query = createFilterQueryString(appliedFilters);
      const res = await apiClient.get<BaseResponse<AdmissionResponse[]>>(
        `/admission${query ? `?${query}` : ""}`,
        { withCredentials: true }
      );
      if (res.data.status === "success") return res.data.data;
      return [];
    },
  });

  const { form, onSubmit } = useCreateAdmissionShellForm(draftFilters.semester);
  const { onPortStudents, isPorting } = usePortStudents();
  const selectedSemesterId = showFilters ? draftFilters.semester : "";
  const selectedTerm = termOptions.find(
    (t) => t.id === draftFilters.academicTerm
  );
  const nestedSemesters = selectedTerm?.Semester || [];
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
    (admission) => !admission.usn
  );

  const alreadyPortedAdmissions = approvedAdmissions.filter(
    (admission) => !!admission.usn
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

  const updateDraftFilter = (key: keyof AdmissionFilters, value: string) => {
    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const admissionFilterFields: FilterFieldConfig<AdmissionFilters>[] = [
    {
      key: "applicationId",
      label: "Application ID",
      type: "text",
      placeholder: "Search application ID",
      inputId: "admission-application-id",
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
      options: ADMISSION_MODES.map((mode) => ({
        label: mode,
        value: mode,
      })),
    },
    {
      key: "createdFrom",
      label: "Created From",
      type: "date",
      inputId: "admission-created-from",
    },
    {
      key: "createdTo",
      label: "Created To",
      type: "date",
      inputId: "admission-created-to",
    },
    {
      key: "academicTerm",
      label: "Academic Term",
      type: "select",
      placeholder: "All terms",
      allOptionLabel: "All terms",
      options: termOptions.map((term) => ({
        label: `${term.type} ${term.year}`,
        value: term.id,
      })),
    },
    {
      key: "semester",
      label: "Semester",
      type: "select",
      placeholder: "All semesters",
      allOptionLabel: "All semesters",
      options: nestedSemesters.map((semester) => ({
        label: `${semester.programType} - Semester ${semester.semesterNumber}`,
        value: semester.id,
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
    if (showFilters) {
      router.replace(pathname, { scroll: false });
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-card text-card-foreground space-y-6 rounded-lg border p-6 shadow-sm">
        {showFilters ? (
          <div className="space-y-4">
            <FilterBuilder
              fields={admissionFilterFields}
              draftFilters={draftFilters}
              onDraftChange={updateDraftFilter}
              allValue={ALL_FILTERS_VALUE}
              className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-6"
            />

            <FilterActions onApply={applyFilters} onReset={resetFilters} />
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="w-60 space-y-2">
              <Label>Academic Term</Label>
              <Select
                value={draftFilters.academicTerm || ALL_FILTERS_VALUE}
                onValueChange={(value) => {
                  const academicTerm = value === ALL_FILTERS_VALUE ? "" : value;
                  setDraftFilters((prev) => ({
                    ...prev,
                    academicTerm,
                    semester: "",
                  }));
                  setAppliedFilters({
                    ...EMPTY_FILTERS,
                    academicTerm,
                    semester: "",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTERS_VALUE}>All terms</SelectItem>
                  {termOptions.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.type} {term.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-60 space-y-2">
              <Label>Admission Semester</Label>
              <Select
                value={draftFilters.semester || ALL_FILTERS_VALUE}
                disabled={!draftFilters.academicTerm}
                onValueChange={(value) => {
                  const semester = value === ALL_FILTERS_VALUE ? "" : value;
                  setDraftFilters((prev) => ({ ...prev, semester }));
                  setAppliedFilters((prev) => ({ ...prev, semester }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTERS_VALUE}>
                    All semesters
                  </SelectItem>
                  {nestedSemesters.map((semester) => (
                    <SelectItem key={semester.id} value={semester.id}>
                      {semester.programType} - Semester{" "}
                      {semester.semesterNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!hideAddForm && canCreate && (
              <DialogForm
                trigger={
                  <Button disabled={!draftFilters.semester}>
                    Add Admission
                  </Button>
                }
                title="Create Admission Profile"
                form={form}
                onSubmit={onSubmit}
              >
                <FormField
                  control={form.control}
                  name="applicationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application ID *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., APP-2026-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="modeOfAdmission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mode of Admission *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select admission mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ADMISSION_MODES.map((mode) => (
                            <SelectItem key={mode} value={mode}>
                              {mode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department / Branch *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments?.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryClaimed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category Claimed *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["GENERAL", "OBC", "SC", "ST"].map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryAllotted"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category Allotted *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["GENERAL", "OBC", "SC", "ST"].map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quota"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quota *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select quota" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["MERIT", "MANAGEMENT", "SPORTS", "NRI", "SNQ"].map(
                            (q) => (
                              <SelectItem key={q} value={q}>
                                {q}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </DialogForm>
            )}
          </div>
        )}

        {!showFilters &&
          !hideAddForm &&
          canCreate &&
          !draftFilters.semester && (
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
                ? "Filter by application ID, status, mode, created date, and semester."
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
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">
                              Application ID
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Student Name
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {admissionsToPort.map((admission) => {
                            const fullName = [
                              admission.firstName,
                              admission.middleName,
                              admission.lastName,
                            ]
                              .filter(Boolean)
                              .join(" ");
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
              columns={getAdminAdmissionColumns(showFilters)}
              data={admissions || []}
            />
          </div>
        )}
      </div>
    </div>
  );
};
