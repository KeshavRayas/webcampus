"use client";

import { cn } from "@webcampus/ui/lib/utils";
import * as React from "react";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Label } from "./label";
import { MultiSelectFilter } from "./multi-select-filter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export const DEFAULT_FILTER_ALL_VALUE = "__all__";

export type FilterFieldType = "text" | "select" | "date" | "multiselect";

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
  columnKey?: string;
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
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4",
        className
      )}
      {...props}
    />
  );
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
    <div className={cn("flex flex-wrap justify-end gap-2", className)}>
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
  toggles,
  onToggle,
  showToggles = true,
}: {
  fields: FilterFieldConfig<TFilters>[];
  draftFilters: TFilters;
  onDraftChange: (key: FilterKey<TFilters>, value: string) => void;
  allValue?: string;
  className?: string;
  toggles?: Record<string, boolean>;
  onToggle?: (columnKey: string) => void;
  showToggles?: boolean;
}) {
  const renderFieldLabel = (
    field: FilterFieldConfig<TFilters>,
    inputId: string
  ) => {
    const columnKey = field.columnKey;
    if (columnKey && showToggles) {
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={!!toggles?.[columnKey]}
            onCheckedChange={() => onToggle?.(columnKey)}
          />
          <Label>{field.label}</Label>
        </div>
      );
    }
    if (field.type === "text" || field.type === "date") {
      return <Label htmlFor={inputId}>{field.label}</Label>;
    }
    return <Label>{field.label}</Label>;
  };

  return (
    <FilterGrid className={className}>
      {fields.map((field) => {
        const filterKey = field.key;
        const rawValue = draftFilters[filterKey];
        const value = rawValue ?? "";
        const inputId = field.inputId ?? `filter-${String(filterKey)}`;

        if (field.type === "multiselect") {
          const options = field.options ?? [];
          return (
            <div
              className={cn("space-y-2", field.className)}
              key={String(filterKey)}
            >
              {renderFieldLabel(field, inputId)}
              <MultiSelectFilter
                options={options}
                value={value}
                onChange={(nextValue) => onDraftChange(filterKey, nextValue)}
                placeholder={
                  field.placeholder ?? `All ${field.label.toLowerCase()}`
                }
              />
            </div>
          );
        }

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
              {renderFieldLabel(field, inputId)}
              <Select
                value={shouldHideAll ? value : value || allValue}
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
            {renderFieldLabel(field, inputId)}
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
