"use client";

import { apiClient } from "@/lib/api-client";
import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { useQuery } from "@tanstack/react-query";
import { SemesterResponseType } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
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

const ADMISSION_MODES = ["KCET", "COMEDK", "Management", "SNQ Quota", "Other"];
const ADMISSION_STATUSES = ["PENDING", "SUBMITTED", "APPROVED", "REJECTED"];
const ALL_FILTERS_VALUE = "__all__";

type AdmissionFilters = {
  applicationId: string;
  status: string;
  mode: string;
  semester: string;
  createdFrom: string;
  createdTo: string;
};

const EMPTY_FILTERS: AdmissionFilters = {
  applicationId: "",
  status: "",
  mode: "",
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

  useEffect(() => {
    if (!showFilters) return;
    const nextFilters = getFiltersFromSearchParams(searchParams, EMPTY_FILTERS);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams, showFilters]);

  // 1. Fetch Semesters
  const { data: semesters } = useQuery({
    queryKey: ["semesters"],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<SemesterResponseType[]>>(
        `/admin/semester`,
        { withCredentials: true }
      );
      if (res.data.status === "success") return res.data.data;
      return [];
    },
  });

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
      key: "semester",
      label: "Semester",
      type: "select",
      placeholder: "All semesters",
      allOptionLabel: "All semesters",
      options: (semesters || []).map((semester) => ({
        label: semester.name,
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
              <Label>Admission Semester</Label>
              <Select
                value={draftFilters.semester || ALL_FILTERS_VALUE}
                onValueChange={(value) => {
                  const semester = value === ALL_FILTERS_VALUE ? "" : value;
                  setDraftFilters((prev) => ({ ...prev, semester }));
                  setAppliedFilters({ ...EMPTY_FILTERS, semester });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTERS_VALUE}>
                    All semesters
                  </SelectItem>
                  {semesters?.map((semester) => (
                    <SelectItem key={semester.id} value={semester.id}>
                      {semester.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!hideAddForm && (
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
              </DialogForm>
            )}
          </div>
        )}

        {!showFilters && !hideAddForm && !draftFilters.semester && (
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
          </div>
        </div>

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
