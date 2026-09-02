"use client";

import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { zodResolver } from "@hookform/resolvers/zod";
import { getTermLabel } from "@webcampus/common/term-label";
import {
  SemesterLifecycleStatusSchema,
  SemesterTypeSchema,
  TermParitySchema,
} from "@webcampus/schemas/admin";
import { Button } from "@webcampus/ui/components/button"; // Add this import

import {
  DEFAULT_FILTER_ALL_VALUE,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import { Page, PageContent, PageHeader } from "@webcampus/ui/components/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { DialogForm } from "@webcampus/ui/molecules/dialog-form";
import { ArrowRight, Check } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AdminTermCard } from "./admin-term-card";
import {
  ParityBadge,
  ParityCardClasses,
  ParitySemesterChips,
} from "./parity-semesters";
import { useAcademicTerms, useCreateAcademicTerm } from "./use-academic-term";

type SemesterFilters = {
  status: string;
  type: string;
  year: string;
};

const DEFAULT_SEMESTER_FILTERS: SemesterFilters = {
  status: "ACTIVE",
  type: "",
  year: "",
};

const normalizeFilters = (filters: SemesterFilters): SemesterFilters => ({
  status: filters.status !== undefined ? filters.status : "ACTIVE",
  type: filters.type || "",
  year: filters.year || "",
});

const createSchema = z
  .object({
    type: SemesterTypeSchema,
    parity: TermParitySchema.optional(),
    year: z.string().min(4, "Year is required"),
  })
  .superRefine((data, ctx) => {
    if (data.type === "supplementary" && !data.parity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parity"],
        message: "Select Odd or Even for a supplementary term",
      });
    }
  });

export const AdminSemesterView = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [draftFilters, setDraftFilters] = React.useState<SemesterFilters>(() =>
    normalizeFilters(
      getFiltersFromSearchParams(searchParams, DEFAULT_SEMESTER_FILTERS)
    )
  );
  const [appliedFilters, setAppliedFilters] = React.useState<SemesterFilters>(
    () =>
      normalizeFilters(
        getFiltersFromSearchParams(searchParams, DEFAULT_SEMESTER_FILTERS)
      )
  );

  React.useEffect(() => {
    const nextFilters = normalizeFilters(
      getFiltersFromSearchParams(searchParams, DEFAULT_SEMESTER_FILTERS)
    );
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams]);

  const { data: terms, isLoading } = useAcademicTerms({
    status: SemesterLifecycleStatusSchema.safeParse(appliedFilters.status)
      .success
      ? (appliedFilters.status as z.infer<typeof SemesterLifecycleStatusSchema>)
      : undefined, // Changed from "ACTIVE" to undefined to fetch all statuses
    type: SemesterTypeSchema.safeParse(appliedFilters.type).success
      ? (appliedFilters.type as z.infer<typeof SemesterTypeSchema>)
      : undefined,
    year: appliedFilters.year || undefined,
  });
  const { mutate: createTerm } = useCreateAcademicTerm();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) =>
    (currentYear + i).toString()
  );

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      type: "odd",
      year: currentYear.toString(),
    },
  });

  const onSubmit = (data: z.infer<typeof createSchema>) => {
    createTerm(data);
  };

  const handleFilterChange = (key: keyof SemesterFilters, value: string) => {
    const nextFilters = normalizeFilters({
      ...appliedFilters,
      [key]: value,
    });

    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);

    const query = createFilterQueryString(nextFilters);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  };

  const semesterFilterFields: FilterFieldConfig<SemesterFilters>[] = [
    {
      key: "status",
      label: "Semester Status",
      type: "select",
      placeholder: "All statuses",
      allOptionLabel: "All statuses",
      options: SemesterLifecycleStatusSchema.options.map((status) => ({
        label: status,
        value: status,
      })),
    },
    {
      key: "type",
      label: "Term Type",
      type: "select",
      placeholder: "All term types",
      allOptionLabel: "All term types",
      options: SemesterTypeSchema.options.map((type) => ({
        label: type.charAt(0).toUpperCase() + type.slice(1),
        value: type,
      })),
    },
    {
      key: "year",
      label: "Year",
      type: "select",
      placeholder: "All years",
      allOptionLabel: "All years",
      options: years.map((year) => ({
        label: year,
        value: year,
      })),
    },
  ];

  const resetFilters = () => {
    const nextFilters = DEFAULT_SEMESTER_FILTERS;
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    const query = createFilterQueryString(nextFilters);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  };

  if (isLoading) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        Loading academic terms...
      </div>
    );
  }

  return (
    <div>
      <Page>
        <PageHeader title="Semesters & Academic Terms">
          <DialogForm
            title="Create Academic Term"
            trigger={"Create Term"}
            form={form}
            onSubmit={onSubmit}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (value !== "supplementary") {
                          form.setValue("parity", undefined);
                        }
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SemesterTypeSchema.options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("type") === "supplementary" && (
                <FormField
                  control={form.control}
                  name="parity"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Supplementary Of</FormLabel>
                      <div
                        role="radiogroup"
                        aria-label="Supplementary parity"
                        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                      >
                        {TermParitySchema.options.map((option) => {
                          const selected = field.value === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              className={ParityCardClasses({ selected })}
                              onClick={() => field.onChange(option)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-base font-bold uppercase tracking-wide">
                                  {option}
                                </span>
                                <ParityBadge />
                                {selected && (
                                  <span className="bg-primary text-primary-foreground ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                                    <Check className="h-3 w-3" />
                                  </span>
                                )}
                              </div>
                              <div className="mt-2.5">
                                <ParitySemesterChips parity={option} />
                              </div>
                              <p className="text-muted-foreground mt-2.5 text-xs">
                                Covers exams for {option}-numbered semesters of
                                the selected year.
                              </p>
                            </button>
                          );
                        })}
                      </div>
                      <div className="bg-muted/30 flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-sm">
                        <span className="text-muted-foreground">
                          Will create
                        </span>
                        <ArrowRight className="text-muted-foreground h-3.5 w-3.5" />
                        {field.value ? (
                          <span className="font-semibold tracking-wide">
                            {getTermLabel(
                              "supplementary",
                              form.watch("year"),
                              field.value
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            Pick a parity card to see the term label
                          </span>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </DialogForm>
        </PageHeader>
        <PageContent>
          <FilterPanel>
            <FilterBuilder
              fields={semesterFilterFields}
              draftFilters={draftFilters}
              onDraftChange={handleFilterChange}
              allValue={DEFAULT_FILTER_ALL_VALUE}
            />
            <div className="flex w-full justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Clear Filters
              </Button>
            </div>
          </FilterPanel>
          {terms && terms.length > 0 ? (
            <div className="space-y-4">
              {terms.map((term) => (
                <AdminTermCard key={term.id} term={term} />
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground bg-muted/10 rounded-lg border py-8 text-center">
              No academic terms created yet. Create one to get started.
            </div>
          )}
        </PageContent>
      </Page>
    </div>
  );
};
