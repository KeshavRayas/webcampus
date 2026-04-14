"use client";

import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
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
import { Check, ChevronsUpDown, X } from "lucide-react";
import * as React from "react";

export interface MultiComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface MultiComboboxProps {
  options: MultiComboboxOption[];
  value: string[];
  onValueChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled = false,
  className,
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOptions = options.filter((opt) => value.includes(opt.value));

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onValueChange(value.filter((v) => v !== optionValue));
    } else {
      onValueChange([...value, optionValue]);
    }
  };

  const removeOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(value.filter((v) => v !== optionValue));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "min-h-10 w-full justify-between font-normal",
            !selectedOptions.length && "text-muted-foreground",
            className
          )}
        >
          <span className="flex flex-1 flex-wrap items-center gap-1 overflow-hidden">
            {selectedOptions.length > 0 ? (
              selectedOptions.map((opt) => (
                <Badge
                  key={opt.value}
                  variant="secondary"
                  className="flex items-center gap-1 px-1.5 py-0 text-xs"
                >
                  <span className="truncate">{opt.label}</span>
                  {!disabled && (
                    <X
                      className="size-3 cursor-pointer opacity-60 hover:opacity-100"
                      onClick={(e) => removeOption(opt.value, e)}
                    />
                  )}
                </Badge>
              ))
            ) : (
              <span>{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.sublabel ?? ""}`}
                  onSelect={() => toggleOption(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                  {option.sublabel && (
                    <span className="text-muted-foreground ml-1.5 text-xs">
                      ({option.sublabel})
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
