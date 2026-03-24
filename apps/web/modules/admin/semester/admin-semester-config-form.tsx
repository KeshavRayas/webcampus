"use client";

import { authClient } from "@/lib/auth-client";
import { dayjs } from "@webcampus/common/dayjs";
import {
  CreateSemesterConfigType,
  SemesterConfigResponseType,
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
import {
  useBulkUpsertSemesters,
  useSemestersByTerm,
} from "./use-semester-config";

export const AdminSemesterConfigForm = ({
  termId,
  termType,
}: {
  termId: string;
  termType: "odd" | "even";
}) => {
  const { data: session } = authClient.useSession();
  const { data: existingSemesters, isLoading } = useSemestersByTerm(termId);
  const { mutate: bulkUpsert, isPending } = useBulkUpsertSemesters(termId);

  const ugNumbers = termType === "odd" ? [1, 3, 5, 7] : [2, 4, 6, 8];
  const pgNumbers = termType === "odd" ? [1, 3] : [2, 4];

  const currentYear = new Date().getFullYear();

  // Local state for the forms
  const [dates, setDates] = useState<
    Record<string, { startDate: Date | undefined; endDate: Date | undefined }>
  >({});

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
  };

  const handleSave = () => {
    if (!session?.user?.id) return;

    const payload: CreateSemesterConfigType[] = [];

    const addPayload = (programType: "UG" | "PG", nums: number[]) => {
      nums.forEach((num) => {
        const key = `${programType}-${num}`;
        const config = dates[key];
        if (config?.startDate && config?.endDate) {
          payload.push({
            academicTermId: termId,
            programType,
            semesterNumber: num,
            termType,
            startDate: config.startDate,
            endDate: config.endDate,
            userId: session.user.id,
          });
        }
      });
    };

    addPayload("UG", ugNumbers);
    addPayload("PG", pgNumbers);

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
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "h-8 text-left text-sm font-normal",
                !value && "text-muted-foreground"
              )}
            >
              {value ? (
                dayjs(value).format("MMM D, YYYY")
              ) : (
                <span>Pick date</span>
              )}
              <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
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

  return (
    <div className="mt-4 space-y-6 border-t pt-4">
      <div>
        <h4 className="mb-3 font-semibold">Undergraduate (UG) Semesters</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ugNumbers.map((num) => {
            const key = `UG-${num}`;
            return (
              <div
                key={key}
                className="bg-muted/20 space-y-3 rounded-md border p-3"
              >
                <p className="text-sm font-medium">Semester {num}</p>
                {renderDateField(key, "startDate", "Start Date")}
                {renderDateField(key, "endDate", "End Date")}
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
            return (
              <div
                key={key}
                className="bg-muted/20 space-y-3 rounded-md border p-3"
              >
                <p className="text-sm font-medium">Semester {num}</p>
                {renderDateField(key, "startDate", "Start Date")}
                {renderDateField(key, "endDate", "End Date")}
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
