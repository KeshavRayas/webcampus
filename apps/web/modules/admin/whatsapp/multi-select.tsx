"use client";

import { Checkbox } from "@webcampus/ui/components/checkbox";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@webcampus/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@webcampus/ui/components/popover";
import { cn } from "@webcampus/ui/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

type MultiSelectOption = {
  value: string;
  label: string;
};

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select...",
  emptyText = "No results found",
  disabled,
  className,
}: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  const selectedLabels = options
    .filter((o) => selected.includes(o.value))
    .map((o) => o.label);

  const triggerText =
    selectedLabels.length > 0
      ? selectedLabels.length > 3
        ? `${selectedLabels.length} selected`
        : selectedLabels.join(", ")
      : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "border-input data-[placeholder]:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border bg-transparent px-3 py-2 text-left text-sm outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className="line-clamp-1 flex items-center gap-2">
            {selectedLabels.length > 0 && (
              <Check className="text-primary size-4 shrink-0" />
            )}
            <span className="truncate">{triggerText}</span>
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => toggle(option.value)}
                  className="flex items-center gap-2"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggle(option.value)}
                  />
                  <span className="flex-1 truncate">{option.label}</span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
