"use client";

import {
  createFilterQueryString,
  getFiltersFromSearchParams,
} from "@/lib/filter-search-params";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  SemesterLifecycleStatusSchema,
  SemesterTypeSchema,
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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AdminTermCard } from "./admin-term-card";
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

const createSchema = z.object({
  type: SemesterTypeSchema,
  year: z.string().min(4, "Year is required"),
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
      placeholder: "All",
      allOptionLabel: "All",
      options: SemesterLifecycleStatusSchema.options.map((status) => ({
        label: status,
        value: status,
      })),
    },
    {
      key: "type",
      label: "Term Type",
      type: "select",
      placeholder: "All",
      allOptionLabel: "All",
      options: SemesterTypeSchema.options.map((type) => ({
        label: type.charAt(0).toUpperCase() + type.slice(1),
        value: type,
      })),
    },
    {
      key: "year",
      label: "Year",
      type: "select",
      placeholder: "All",
      allOptionLabel: "All",
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
                      onValueChange={field.onChange}
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
              className="grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
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
