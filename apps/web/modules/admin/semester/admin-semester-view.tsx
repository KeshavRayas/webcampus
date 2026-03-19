"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { dayjs } from "@webcampus/common/dayjs";
import {
  SemesterResponseType,
  SemesterTypeSchema,
} from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { Calendar } from "@webcampus/ui/components/calendar";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import { Page, PageContent, PageHeader } from "@webcampus/ui/components/page";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@webcampus/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { cn } from "@webcampus/ui/lib/utils";
import { DialogForm } from "@webcampus/ui/molecules/dialog-form";
import { CalendarIcon } from "lucide-react";
import React from "react";
import { AdminSemesterColumns } from "./admin-semester-columns";
import { useSemesterCreateSchema } from "./use-semester-create-schema";

const ODD_SEMESTER_NUMBERS = [1, 3, 5, 7];
const EVEN_SEMESTER_NUMBERS = [2, 4, 6, 8];

export const AdminSemesterView = () => {
  const { data: semesters, isLoading } = useQuery({
    queryKey: ["semesters"],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<SemesterResponseType[]>>(
        `/admin/semester`,
        {
          withCredentials: true,
        }
      );
      if (res.data.status === "success") {
        return res.data.data;
      }
      return [] as SemesterResponseType[];
    },
  });

  const { form, onSubmit } = useSemesterCreateSchema(semesters ?? undefined);

  const watchedType = form.watch("type");
  const semesterNumberOptions =
    watchedType === "odd" ? ODD_SEMESTER_NUMBERS : EVEN_SEMESTER_NUMBERS;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) =>
    (currentYear + i).toString()
  );

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center">Loading semesters...</div>;
  }

  return (
    <div>
      <Page>
        <PageHeader title="Semesters">
          <DialogForm
            title="Create Semester"
            trigger={"Create Semester"}
            form={form}
            onSubmit={onSubmit}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="flex h-full flex-col">
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue(
                            "semesterNumber",
                            value === "odd" ? 1 : 2,
                            {
                              shouldValidate: true,
                            }
                          );
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="w-full">
                          {SemesterTypeSchema.options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option.charAt(0).toUpperCase() + option.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <p className="text-muted-foreground mt-1 min-h-5 text-sm">
                      {watchedType
                        ? `Applies to semesters: ${watchedType === "odd" ? "1, 3, 5, 7" : "2, 4, 6, 8"}`
                        : "\u00A0"}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem className="flex h-full flex-col">
                    <FormLabel>Year</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="w-full">
                          {years.map((year) => (
                            <SelectItem key={year} value={year}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <p className="mt-1 min-h-5 text-sm">\u00A0</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="semesterNumber"
                render={({ field }) => (
                  <FormItem className="flex h-full flex-col">
                    <FormLabel>Semester Number</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(Number.parseInt(value, 10))
                        }
                        value={String(field.value)}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Semester Number" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="w-full">
                          {semesterNumberOptions.map((semesterNumber) => (
                            <SelectItem
                              key={semesterNumber}
                              value={String(semesterNumber)}
                            >
                              Semester {semesterNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <p className="text-muted-foreground mt-1 min-h-5 text-sm">
                      Must match selected type ({watchedType === "odd" ? "odd" : "even"}).
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              dayjs(field.value).format("MMMM D, YYYY")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon
                              className="ml-auto h-4 w-4 opacity-50"
                              aria-label="Open calendar"
                            />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          captionLayout="dropdown"
                          fromYear={currentYear - 5}
                          toYear={currentYear + 10}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              dayjs(field.value).format("MMMM D, YYYY")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon
                              className="ml-auto h-4 w-4 opacity-50"
                              aria-label="Open calendar"
                            />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          captionLayout="dropdown"
                          fromYear={currentYear - 5}
                          toYear={currentYear + 10}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </DialogForm>
        </PageHeader>
        <PageContent>
          {semesters && semesters.length > 0 ? (
            <DataTable columns={AdminSemesterColumns} data={semesters} />
          ) : (
            <div className="text-muted-foreground py-8 text-center">
              No semesters created yet. Create one to get started.
            </div>
          )}
        </PageContent>
      </Page>
    </div>
  );
};
