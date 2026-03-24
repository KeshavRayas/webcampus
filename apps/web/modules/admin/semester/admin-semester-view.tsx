"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SemesterTypeSchema } from "@webcampus/schemas/admin";
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
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AdminTermCard } from "./admin-term-card";
import { useAcademicTerms, useCreateAcademicTerm } from "./use-academic-term";

const createSchema = z.object({
  type: SemesterTypeSchema,
  year: z.string().min(4, "Year is required"),
});

export const AdminSemesterView = () => {
  const { data: terms, isLoading } = useAcademicTerms();
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
