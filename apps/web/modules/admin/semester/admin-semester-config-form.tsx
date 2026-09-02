"use client";

import { dayjs } from "@webcampus/common/dayjs";
import {
  CreateSemesterConfigType,
  SemesterConfigResponseType,
  TermParitySchema,
} from "@webcampus/schemas/admin";
import { Button } from "@webcampus/ui/components/button";
import { Calendar } from "@webcampus/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@webcampus/ui/components/popover";
import { cn } from "@webcampus/ui/lib/utils";
import { CalendarIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { PARITY_SEMESTERS, ParitySemesterChips } from "./parity-semesters";
import { useUpdateAcademicTerm } from "./use-academic-term";
import {
  useBulkUpsertSemesters,
  useSemestersByTerm,
} from "./use-semester-config";

export const AdminSemesterConfigForm = ({
  termId,
  termType,
  parity,
  year,
}: {
  termId: string;
  termType: "odd" | "even" | "supplementary";
  parity?: "odd" | "even" | null;
  year: string;
}) => {
  const { data: existingSemesters, isLoading } = useSemestersByTerm(termId);
  const { mutate: bulkUpsert, isPending } = useBulkUpsertSemesters(termId);
  const { mutate: updateTerm } = useUpdateAcademicTerm();

  const oddNumbers = PARITY_SEMESTERS.odd;
  const evenNumbers = PARITY_SEMESTERS.even;
  const resolvedParity =
    termType === "supplementary"
      ? (parity ?? null)
      : (termType as "odd" | "even");
  const numbers =
    resolvedParity === "odd"
      ? oddNumbers
      : resolvedParity === "even"
        ? evenNumbers
        : null;
  const ugNumbers = numbers?.ug ?? [];
  const pgNumbers = numbers?.pg ?? [];

  const currentYear = new Date().getFullYear();

  const [dates, setDates] = useState<
    Record<string, { startDate: Date | undefined; endDate: Date | undefined }>
  >({});

  // Issue 3: Local state to track exact validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (existingSemesters && existingSemesters.length > 0) {
      const initialDates: Record<string, { startDate: Date; endDate: Date }> =
        {};
      existingSemesters.forEach((sem: SemesterConfigResponseType) => {
        initialDates[`${sem.programType}-${sem.semesterNumber}`] = {
          startDate: new Date(sem.startDate),
          endDate: new Date(sem.endDate),
        };
      });
      setDates(initialDates);
    }
  }, [existingSemesters]);

  const handleDateChange = (
    key: string,
    field: "startDate" | "endDate",
    value: Date | undefined
  ) => {
    setDates((prev) => ({
      ...prev,
      [key]: {
        startDate: prev[key]?.startDate,
        endDate: prev[key]?.endDate,
        [field]: value,
      },
    }));

    // Clear the error for this specific semester once the user modifies it
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const handleSave = () => {
    const payload: CreateSemesterConfigType[] = [];
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    const validateAndAdd = (programType: "UG" | "PG", nums: number[]) => {
      nums.forEach((num) => {
        const key = `${programType}-${num}`;
        const config = dates[key];

        if (config) {
          const { startDate, endDate } = config;

          // Issue 3 Validation: Ensure both dates are provided if one is filled
          if ((startDate && !endDate) || (!startDate && endDate)) {
            newErrors[key] = "Both start and end dates must be provided.";
            hasErrors = true;
          }
          // Issue 3 Validation: Ensure End Date is after Start Date
          else if (startDate && endDate) {
            if (dayjs(endDate).isBefore(dayjs(startDate))) {
              newErrors[key] = "End date cannot be before start date.";
              hasErrors = true;
            } else {
              payload.push({
                academicTermId: termId,
                programType,
                semesterNumber: num,
                termType,
                startDate,
                endDate,
              });
            }
          }
        }
      });
    };

    validateAndAdd("UG", ugNumbers);
    validateAndAdd("PG", pgNumbers);

    if (hasErrors) {
      setErrors(newErrors);
      return; // Abort saving if errors exist
    }

    if (payload.length === 0) return;
    bulkUpsert(payload);
  };

  const renderDateField = (
    key: string,
    field: "startDate" | "endDate",
    label: string
  ) => {
    const value = dates[key]?.[field];
    return (
      <div className="flex flex-1 flex-col gap-1.5">
        <label className="text-muted-foreground text-xs font-semibold">
          {label}
        </label>
        <Popover>
          {/* Issue 2: Allow typing directly via native date input while keeping Popover UI */}
          <div className="border-input focus-within:ring-ring flex items-center rounded-md border bg-transparent shadow-sm focus-within:ring-1">
            <input
              type="date"
              className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent px-3 py-1 text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:opacity-0"
              value={value ? dayjs(value).format("YYYY-MM-DD") : ""}
              onChange={(e) => {
                if (e.target.value) {
                  // dayjs handles the local time zone correctly when given YYYY-MM-DD
                  handleDateChange(key, field, dayjs(e.target.value).toDate());
                } else {
                  handleDateChange(key, field, undefined);
                }
              }}
            />
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-9 w-9 shrink-0 rounded-l-none hover:bg-transparent"
              >
                <CalendarIcon className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
          </div>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={value}
              onSelect={(d) => handleDateChange(key, field, d)}
              captionLayout="dropdown"
              fromYear={currentYear - 2}
              toYear={currentYear + 5}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  if (isLoading)
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        Loading configurations...
      </div>
    );

  if (termType === "supplementary" && !resolvedParity) {
    return (
      <div className="mt-4 space-y-3 rounded-md border border-dashed p-4">
        <p className="text-muted-foreground text-sm">
          This supplementary term was created before parity tracking and has no
          Odd/Even scope set. Choose one to configure its semesters.
        </p>
        <div className="flex flex-wrap gap-2">
          {TermParitySchema.options.map((option) => (
            <Button
              key={option}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto py-2"
              disabled={isPending}
              onClick={() =>
                updateTerm({
                  id: termId,
                  data: { type: "supplementary", parity: option, year },
                })
              }
            >
              <span className="flex flex-col items-start gap-1.5">
                <span className="font-semibold uppercase tracking-wide">
                  {option} Supplementary
                </span>
                <ParitySemesterChips parity={option} />
              </span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-6 border-t pt-4">
      {termType === "supplementary" &&
        (resolvedParity === "odd" || resolvedParity === "even") && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium">
            <span className="text-foreground font-semibold uppercase tracking-wide">
              {resolvedParity} Supplementary
            </span>
            <span>hosts:</span>
            <ParitySemesterChips parity={resolvedParity} />
          </div>
        )}
      <div>
        <h4 className="mb-3 font-semibold">Undergraduate (UG) Semesters</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ugNumbers.map((num) => {
            const key = `UG-${num}`;
            const error = errors[key];
            return (
              <div
                key={key}
                className={cn(
                  "bg-muted/20 space-y-3 rounded-md border p-3 transition-colors",
                  error && "border-red-500 bg-red-50 dark:bg-red-950/20" // Issue 3 Highlight
                )}
              >
                <p className="text-sm font-medium">Semester {num}</p>
                {renderDateField(key, "startDate", "Start Date")}
                {renderDateField(key, "endDate", "End Date")}
                {error && (
                  <p className="text-xs font-semibold text-red-500">{error}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="mb-3 font-semibold">Postgraduate (PG) Semesters</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {pgNumbers.map((num) => {
            const key = `PG-${num}`;
            const error = errors[key];
            return (
              <div
                key={key}
                className={cn(
                  "bg-muted/20 space-y-3 rounded-md border p-3 transition-colors",
                  error && "border-red-500 bg-red-50 dark:bg-red-950/20" // Issue 3 Highlight
                )}
              >
                <p className="text-sm font-medium">Semester {num}</p>
                {renderDateField(key, "startDate", "Start Date")}
                {renderDateField(key, "endDate", "End Date")}
                {error && (
                  <p className="text-xs font-semibold text-red-500">{error}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save Configurations"}
        </Button>
      </div>
    </div>
  );
};
