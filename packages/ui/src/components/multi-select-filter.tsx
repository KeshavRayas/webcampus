"use client";

import { cn } from "@webcampus/ui/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export type MultiSelectOption = {
  label: React.ReactNode;
  value: string;
};

/**
 * Multi-select filter with checkboxes.
 *
 * Value semantics:
 * - `""` means every option is selected (no filtering applied).
 * - otherwise it is a comma-joined list of the selected option values.
 *
 * A minimum of one option is always kept checked.
 */
export function MultiSelectFilter({
  options,
  value,
  onChange,
  placeholder = "All",
  className,
}: {
  options: MultiSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const allValues = useMemo(
    () => options.map((option) => option.value),
    [options]
  );

  const selected = useMemo(() => {
    if (!value) return new Set(allValues);
    return new Set(value.split(",").filter(Boolean));
  }, [value, allValues]);

  const isAllSelected = selected.size >= allValues.length;

  const emitSelection = (next: Set<string>) => {
    if (next.size === 0) return;
    onChange(next.size >= allValues.length ? "" : Array.from(next).join(","));
  };

  const toggleOption = (optionValue: string) => {
    const next = new Set(selected);
    if (next.has(optionValue)) {
      next.delete(optionValue);
    } else {
      next.add(optionValue);
    }
    emitSelection(next);
  };

  const selectAll = () => {
    if (isAllSelected) {
      const first = allValues[0];
      if (first) onChange(first);
      return;
    }
    onChange("");
  };

  const triggerLabel = isAllSelected
    ? placeholder
    : `${selected.size} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full justify-between gap-2 font-normal",
            className
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2" sideOffset={4}>
        <div className="space-y-1">
          <div
            role="button"
            tabIndex={0}
            onClick={selectAll}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectAll();
              }
            }}
            className="hover:bg-accent focus-visible:ring-ring/50 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none focus-visible:ring-[3px]"
          >
            <Checkbox
              checked={isAllSelected}
              className="pointer-events-none"
              tabIndex={-1}
              aria-hidden="true"
            />
            <span className="flex items-center gap-2 font-medium">
              Select All
              {isAllSelected && <Check className="text-primary size-3.5" />}
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {options.length === 0 ? (
              <p className="text-muted-foreground px-2 py-1.5 text-sm">
                No options available
              </p>
            ) : (
              options.map((option) => {
                const isSelected = selected.has(option.value);
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleOption(option.value);
                      }
                    }}
                    className="hover:bg-accent focus-visible:ring-ring/50 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-[3px]"
                  >
                    <Checkbox
                      checked={isSelected}
                      className="pointer-events-none"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    <span className="truncate">{option.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
