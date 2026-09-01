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
import { type FilterFieldConfig } from "@webcampus/ui/components/filter-builder";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  AdmissionResponse,
  getAdminAdmissionColumns,
  getAdmissionFullName,
} from "../admin/admin-admission-columns";
import { useCreateAdmissionShellForm } from "../admin/use-create-admission-shell-form";
import { AdmissionFilterBar } from "../shared/admission-filter-bar";

type AdmissionFilters = {
  academicTerm: string;
  semester: string;
  search: string;
  createdFrom: string;
  createdTo: string;
};

const EMPTY_FILTERS: AdmissionFilters = {
  academicTerm: "",
  semester: "",
  search: "",
  createdFrom: "",
  createdTo: "",
};

export const AdmissionInstructorView = ({
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
  const canCreate = isMounted && role === "admission-instructor";

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
  const [showPassword, setShowPassword] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createChoice, setCreateChoice] = useState<null | "profile" | "fill">(
    null
  );

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
      (semester.programType === "UG" &&
        (semester.semesterNumber === 1 || semester.semesterNumber === 3)) ||
      (semester.programType === "PG" && semester.semesterNumber === 1)
  );
  const semesterOptions = admissionEligibleSemesters;
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
      const apiFilters: Omit<AdmissionFilters, "search"> = {
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
    let rows = admissions ?? [];
    const search = appliedFilters.search.trim().toLowerCase();
    if (search) {
      rows = rows.filter(
        (admission) =>
          getAdmissionFullName(admission).toLowerCase().includes(search) ||
          admission.primaryEmail.toLowerCase().includes(search)
      );
    }
    return rows;
  }, [admissions, appliedFilters.search]);
  const selectedSemesterId = draftFilters.semester;
  const { form, onSubmit } = useCreateAdmissionShellForm(
    selectedSemesterId,
    departments
  );

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

  const advancedFilterFields: FilterFieldConfig<AdmissionFilters>[] = [
    {
      key: "search",
      label: "Search",
      type: "text",
      placeholder: "Search by name or email",
      inputId: "admission-search",
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

  const fillApplicantPath = "/admission-instructor/fill-applicant";

  const handleCreateDialogOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      setCreateChoice(null);
    }
  };

  const columns = useMemo(
    () => getAdminAdmissionColumns(showFilters, false),
    [showFilters]
  );

  return (
    <div className="admission-instructor-console space-y-8">
      <div className="bg-card text-card-foreground space-y-6 rounded-lg border p-6 shadow-sm">
        <div className="space-y-4">
          <AdmissionFilterBar
            simpleFields={simpleFilterFields}
            advancedFields={advancedFilterFields}
            draftFilters={draftFilters}
            onDraftChange={updateDraftFilter}
            onApply={applyFilters}
            onReset={resetFilters}
            actionSlot={
              !hideAddForm && canCreate ? (
                <Dialog
                  open={isCreateDialogOpen}
                  onOpenChange={handleCreateDialogOpenChange}
                >
                <DialogTrigger asChild>
                  <Button disabled={!draftFilters.semester}>
                    Create Admission
                  </Button>
                </DialogTrigger>
                <DialogContent className="admission-theme-dialog sm:max-w-lg">
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
                                  placeholder="student@bmsu.ac.in"
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
                            className="!rounded-md !border-border !bg-background !text-foreground hover:!bg-accent"
                            onClick={() => setCreateChoice(null)}
                          >
                            Back
                          </Button>
                          <Button
                            type="submit"
                            disabled={form.formState.isSubmitting}
                            className="!rounded-md !border-border !bg-background !text-foreground hover:!bg-accent"
                          >
                            Create Profile
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  )}
                </DialogContent>
              </Dialog>
              ) : undefined
            }
          />
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
                ? "Filter by academic term, semester, and created date."
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
            <DataTable columns={columns} data={relevantAdmissions} />
          </div>
        )}
      </div>
    </div>
  );
};
