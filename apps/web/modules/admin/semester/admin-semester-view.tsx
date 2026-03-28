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
import {
  DEFAULT_FILTER_ALL_VALUE,
  FilterActions,
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
  isCurrent: string;
};

const DEFAULT_SEMESTER_FILTERS: SemesterFilters = {
  status: "ACTIVE",
  type: "",
  year: "",
  isCurrent: "",
};

const normalizeFilters = (filters: SemesterFilters): SemesterFilters => ({
  status: filters.status || "ACTIVE",
  type: filters.type || "",
  year: filters.year || "",
  isCurrent: filters.isCurrent || "",
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
      : "ACTIVE",
    type: SemesterTypeSchema.safeParse(appliedFilters.type).success
      ? (appliedFilters.type as z.infer<typeof SemesterTypeSchema>)
      : undefined,
    year: appliedFilters.year || undefined,
    isCurrent:
      appliedFilters.isCurrent === "true"
        ? true
        : appliedFilters.isCurrent === "false"
          ? false
          : undefined,
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

  const updateDraftFilter = (key: keyof SemesterFilters, value: string) => {
    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const semesterFilterFields: FilterFieldConfig<SemesterFilters>[] = [
    {
      key: "status",
      label: "Semester Status",
      type: "select",
      placeholder: "Filter by status",
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
    {
      key: "isCurrent",
      label: "Current",
      type: "select",
      placeholder: "All",
      allOptionLabel: "All",
      options: [
        { label: "Current", value: "true" },
        { label: "Not Current", value: "false" },
      ],
    },
  ];

  const applyFilters = () => {
    const nextFilters = normalizeFilters(draftFilters);
    setAppliedFilters(nextFilters);
    const query = createFilterQueryString(nextFilters);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  };

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
              onDraftChange={updateDraftFilter}
              allValue={DEFAULT_FILTER_ALL_VALUE}
              className="grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
            />
            <FilterActions onApply={applyFilters} onReset={resetFilters} />
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
