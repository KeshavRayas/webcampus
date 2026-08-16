"use client";

import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@webcampus/ui/components/dialog";
import {
  FilterBuilder,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { FileDown, FilterIcon } from "lucide-react";
import { useState } from "react";

export const ADMISSION_FILTER_ALL_VALUE = "__all__";

export function AdmissionFilterBar<TFilters extends Record<string, string>>({
  simpleFields,
  advancedFields,
  draftFilters,
  onDraftChange,
  onApply,
  onReset,
  allValue = ADMISSION_FILTER_ALL_VALUE,
  dialogTitle = "Advanced Filters",
  dialogDescription = "Use advanced filters to narrow down the results.",
  onGenerateReport,
  reportButtonLabel = "Generate Report PDF",
  fieldToggles,
  onToggleField,
}: {
  simpleFields: FilterFieldConfig<TFilters>[];
  advancedFields: FilterFieldConfig<TFilters>[];
  draftFilters: TFilters;
  onDraftChange: (key: Extract<keyof TFilters, string>, value: string) => void;
  onApply: () => void;
  onReset: () => void;
  allValue?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  onGenerateReport?: () => void;
  reportButtonLabel?: string;
  fieldToggles?: Record<string, boolean>;
  onToggleField?: (columnKey: string) => void;
}) {
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  const handleApply = () => {
    onApply();
    setIsFilterDialogOpen(false);
  };

  const handleReset = () => {
    onReset();
    setIsFilterDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <FilterBuilder
        fields={simpleFields}
        draftFilters={draftFilters}
        onDraftChange={onDraftChange}
        allValue={allValue}
        className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onApply}>
          Apply Filters
        </Button>
        <Button type="button" variant="outline" onClick={onReset}>
          Reset Filters
        </Button>

        <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon" title="Filters">
              <FilterIcon className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </DialogHeader>
            <div className="max-h-[65dvh] overflow-y-auto pr-1">
              <FilterBuilder
                fields={advancedFields}
                draftFilters={draftFilters}
                onDraftChange={onDraftChange}
                allValue={allValue}
                toggles={fieldToggles}
                onToggle={onToggleField}
                className="grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleReset}>
                Reset Filters
              </Button>
              <Button type="button" onClick={handleApply}>
                Apply Filters
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {onGenerateReport && (
          <Button type="button" variant="outline" onClick={onGenerateReport}>
            <FileDown className="mr-2 h-4 w-4" />
            {reportButtonLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
