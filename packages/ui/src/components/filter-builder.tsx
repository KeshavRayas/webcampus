"use client";

import { cn } from "@webcampus/ui/lib/utils";
import * as React from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export const DEFAULT_FILTER_ALL_VALUE = "__all__";

export type FilterFieldType = "text" | "select" | "date";

export type FilterOption = {
  label: React.ReactNode;
  value: string;
};

type FilterKey<TFilters extends Record<string, string>> = Extract<
  keyof TFilters,
  string
>;

export type FilterFieldConfig<TFilters extends Record<string, string>> = {
  key: FilterKey<TFilters>;
  label: string;
  type: FilterFieldType;
  placeholder?: string;
  inputId?: string;
  className?: string;
  options?: FilterOption[];
  allOptionLabel?: string;
  hideAllOption?: boolean;
  formatOptionLabel?: (option: FilterOption) => React.ReactNode;
};

export function FilterPanel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground space-y-4 rounded-lg border p-6 shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function FilterGrid({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-4", className)} {...props} />;
}

export function FilterActions({
  onApply,
  onReset,
  applyLabel = "Apply Filters",
  resetLabel = "Reset Filters",
  isApplyDisabled,
  isResetDisabled,
  className,
}: {
  onApply: () => void;
  onReset: () => void;
  applyLabel?: string;
  resetLabel?: string;
  isApplyDisabled?: boolean;
  isResetDisabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2", className)}>
      <Button type="button" onClick={onApply} disabled={isApplyDisabled}>
        {applyLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onReset}
        disabled={isResetDisabled}
      >
        {resetLabel}
      </Button>
    </div>
  );
}

export function FilterBuilder<TFilters extends Record<string, string>>({
  fields,
  draftFilters,
  onDraftChange,
  allValue = DEFAULT_FILTER_ALL_VALUE,
  className,
}: {
  fields: FilterFieldConfig<TFilters>[];
  draftFilters: TFilters;
  onDraftChange: (key: FilterKey<TFilters>, value: string) => void;
  allValue?: string;
  className?: string;
}) {
  return (
    <FilterGrid className={className}>
      {fields.map((field) => {
        const filterKey = field.key;
        const rawValue = draftFilters[filterKey];
        const value = rawValue ?? "";
        const inputId = field.inputId ?? `filter-${String(filterKey)}`;

        if (field.type === "select") {
          const options = field.options ?? [];
          const allOptionLabel =
            field.allOptionLabel ?? `All ${field.label.toLowerCase()}`;
          const shouldHideAll = field.hideAllOption === true;

          return (
            <div
              className={cn("space-y-2", field.className)}
              key={String(filterKey)}
            >
              <Label>{field.label}</Label>
              <Select
                value={shouldHideAll ? value || undefined : value || allValue}
                onValueChange={(nextValue) =>
                  onDraftChange(
                    filterKey,
                    !shouldHideAll && nextValue === allValue ? "" : nextValue
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={field.placeholder ?? allOptionLabel}
                  />
                </SelectTrigger>
                <SelectContent>
                  {!shouldHideAll && (
                    <SelectItem value={allValue}>{allOptionLabel}</SelectItem>
                  )}
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {field.formatOptionLabel
                        ? field.formatOptionLabel(option)
                        : option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        return (
          <div
            className={cn("space-y-2", field.className)}
            key={String(filterKey)}
          >
            <Label htmlFor={inputId}>{field.label}</Label>
            <Input
              id={inputId}
              type={field.type === "date" ? "date" : "text"}
              placeholder={field.placeholder}
              value={value}
              onChange={(event) => onDraftChange(filterKey, event.target.value)}
            />
          </div>
        );
      })}
    </FilterGrid>
  );
}
